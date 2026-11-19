const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("./config/env");
const pedidosService = require("./business/pedidos-service");
const usuariosService = require("./business/usuarios-service");
const inventarioService = require("./business/inventario-service");
const mesasService = require("./business/mesas-service");
require("dotenv").config();

const app = express();

app.use(express.json());

// Permitir comunicación desde Live Server durante el desarrollo
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});

const PORT = process.env.PORT || 3000;

const dbConfig = {
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName
};

let conexion;
// Validar identificadores positivos
function idValido(id) {
    return Number.isInteger(id) && id > 0;
} 
// =========================
// SEGURIDAD Y AUTENTICACIÓN
// =========================
// Verificar que el usuario tenga un token válido
function verificarToken(req, res, next) {
    const encabezado = req.headers.authorization;

    if (!encabezado || !encabezado.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Acceso denegado. Debe iniciar sesión."
        });
    }

    const token = encabezado.split(" ")[1];

    try {
        const datosUsuario = jwt.verify(token, config.jwtSecret);

        req.usuario = datosUsuario;

        next();
    } catch (error) {
        return res.status(401).json({
            error: "Token inválido o vencido."
        });
    }
}

// Verificar si el usuario tiene uno de los roles permitidos
function autorizarRoles(...rolesPermitidos) {
    return (req, res, next) => {
        const rolesUsuario = req.usuario?.roles ||
            (req.usuario?.rol ? [req.usuario.rol] : []);

        const autorizado = rolesUsuario.some(rol =>
            rolesPermitidos.includes(rol)
        );

        if (!autorizado) {
            return res.status(403).json({
                error: "No tiene permisos para realizar esta operación."
            });
        }

        next();
    };
}

// =========================
// INICIAR SERVIDOR
// =========================

async function iniciarServidor() {
    try {
        conexion = mysql.createPool(dbConfig);
        await conexion.query("SELECT 1");

        console.log("Conexión a MySQL exitosa");

        // Ruta principal
        app.get("/", (req, res) => {
            res.json({
                mensaje: "API del sistema SIAR funcionando"
            });
        }); 
// =========================
// INICIO DE SESIÓN
// =========================
app.post("/api/login", async (req, res) => {
    try {
        const usuario = String(req.body.usuario || "").trim();
        const contrasena = req.body.contrasena;

        if (!usuario || typeof contrasena !== "string" || !contrasena) {
            return res.status(400).json({
                error: "Ingrese usuario y contraseña"
            });
        }

        const [usuarios] = await conexion.execute(
            `SELECT
                u.id_usuario,
                u.nombre,
                u.usuario,
                u.contrasena,
                u.activo,
                r.nombre AS rol,
                r.permisos
             FROM usuario u
             INNER JOIN usuario_rol ur
                ON u.id_usuario = ur.id_usuario
             INNER JOIN rol r
                ON ur.id_rol = r.id_rol
             WHERE u.usuario = ?`,
            [usuario]
        );

        if (usuarios.length === 0 || Number(usuarios[0].activo) !== 1) {
            return res.status(401).json({
                error: "Usuario o contraseña incorrectos"
            });
        }

        const datosUsuario = usuarios[0];

        const contrasenaCorrecta = await bcrypt.compare(
            contrasena,
            datosUsuario.contrasena
        );

        if (!contrasenaCorrecta) {
            return res.status(401).json({
                error: "Usuario o contraseña incorrectos"
            });
        }

        // Obtener todos los roles del usuario
        const roles = [...new Set(usuarios.map(fila => fila.rol))];

        // Unificar los permisos de todos sus roles
        const permisos = {};

        for (const fila of usuarios) {
            let permisosRol = fila.permisos;

            if (typeof permisosRol === "string") {
                permisosRol = JSON.parse(permisosRol);
            }

            if (permisosRol && typeof permisosRol === "object") {
                for (const [clave, valor] of Object.entries(permisosRol)) {
                    if (typeof valor === "boolean") {
                        permisos[clave] = permisos[clave] === true || valor;
                    } else if (!(clave in permisos)) {
                        permisos[clave] = valor;
                    }
                }
            }
        }

        const token = jwt.sign(
            {
                id_usuario: datosUsuario.id_usuario,
                usuario: datosUsuario.usuario,
                roles,
                permisos
            },
            config.jwtSecret,
            { expiresIn: "2h" }
        );

        res.json({
            mensaje: "Inicio de sesión exitoso",
            token,
            usuario: {
                id: datosUsuario.id_usuario,
                nombre: datosUsuario.nombre,
                usuario: datosUsuario.usuario,
                roles,
                permisos
            }
        });

    } catch (error) {
        console.error("Error en login:", error);

        res.status(500).json({
            error: "No se pudo iniciar sesión"
        });
    }
});
// Verificar sesión activa
app.get("/api/sesion", verificarToken, (req, res) => {
    res.json({
        usuario: {
            id: req.usuario.id_usuario,
            nombre: req.usuario.usuario,
            roles: req.usuario.roles,
            permisos: req.usuario.permisos
        }
    });
});

// =========================
// PROTEGER RUTAS DE LA API
// =========================

app.use(
    "/api/categorias",
    verificarToken,
    autorizarRoles("Administrador")
);

app.use(
    "/api/productos",
    verificarToken,
    autorizarRoles("Administrador")
);

app.use(
    "/api/usuarios",
    verificarToken,
    autorizarRoles("Administrador")
);
        // =========================
        // CATEGORÍAS
        // =========================

        // Consultar categorías activas
        app.get("/api/categorias", async (req, res) => {
            try {
                const [categorias] = await conexion.execute(
                    `SELECT id_categoria AS id, nombre
                     FROM categoria
                     WHERE activa = 1
                     ORDER BY nombre`
                );

                res.json(categorias);
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudieron consultar las categorías"
                });
            }
        });

        // Crear categoría
        app.post("/api/categorias", async (req, res) => {
            try {
                const nombre = String(req.body.nombre || "").trim();

                if (!nombre) {
                    return res.status(400).json({
                        error: "El nombre es obligatorio"
                    });
                }

                const [existentes] = await conexion.execute(
                    `SELECT id_categoria
                     FROM categoria
                     WHERE LOWER(nombre) = LOWER(?)
                     AND activa = 1`,
                    [nombre]
                );

                if (existentes.length > 0) {
                    return res.status(400).json({
                        error: "Ya existe una categoría con ese nombre"
                    });
                }

                const [resultado] = await conexion.execute(
                    `INSERT INTO categoria (nombre, activa)
                     VALUES (?, 1)`,
                    [nombre]
                );

                res.status(201).json({
                    mensaje: "Categoría creada",
                    id: resultado.insertId
                });
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudo crear la categoría"
                });
            }
        });

        // Editar categoría
        app.put("/api/categorias/:id", async (req, res) => {
            try {
                const id = Number(req.params.id);
                const nombre = String(req.body.nombre || "").trim();

                if (!idValido(id) || !nombre) {
                    return res.status(400).json({
                        error: "Datos de categoría inválidos"
                    });
                }

                const [duplicadas] = await conexion.execute(
                    `SELECT id_categoria
                     FROM categoria
                     WHERE LOWER(nombre) = LOWER(?)
                     AND activa = 1
                     AND id_categoria <> ?`,
                    [nombre, id]
                );

                if (duplicadas.length > 0) {
                    return res.status(400).json({
                        error: "Ya existe una categoría con ese nombre"
                    });
                }

                const [resultado] = await conexion.execute(
                    `UPDATE categoria
                     SET nombre = ?
                     WHERE id_categoria = ?
                     AND activa = 1`,
                    [nombre, id]
                );

                if (resultado.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Categoría no encontrada"
                    });
                }

                res.json({
                    mensaje: "Categoría actualizada"
                });
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudo actualizar la categoría"
                });
            }
        });

        // Dar de baja una categoría
        app.delete("/api/categorias/:id", async (req, res) => {
            try {
                const id = Number(req.params.id);

                if (!idValido(id)) {
                    return res.status(400).json({
                        error: "Identificador inválido"
                    });
                }

                const [productos] = await conexion.execute(
                    `SELECT id_producto
                     FROM producto
                     WHERE id_categoria = ?
                     AND activo = 1`,
                    [id]
                );

                if (productos.length > 0) {
                    return res.status(400).json({
                        error: "No se puede eliminar: tiene productos asociados"
                    });
                }

                const [resultado] = await conexion.execute(
                    `UPDATE categoria
                     SET activa = 0
                     WHERE id_categoria = ?
                     AND activa = 1`,
                    [id]
                );

                if (resultado.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Categoría no encontrada"
                    });
                }

                res.json({
                    mensaje: "Categoría dada de baja"
                });
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudo dar de baja la categoría"
                });
            }
        });

        // =========================
        // PRODUCTOS
        // =========================

        // Consultar productos activos
        app.get("/api/productos", async (req, res) => {
            try {
                const [productos] = await conexion.execute(
                    `SELECT
                        p.id_producto AS id,
                        p.nombre,
                        p.descripcion,
                        p.precio,
                        p.id_categoria AS categoriaId,
                        p.imagen,
                        p.disponible,
                        p.activo,
                        c.nombre AS categoria
                     FROM producto p
                     INNER JOIN categoria c
                        ON p.id_categoria = c.id_categoria
                     WHERE p.activo = 1
                     ORDER BY p.id_producto`
                );

                res.json(productos);
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudieron consultar los productos"
                });
            }
        });

        // Crear producto
        app.post("/api/productos", async (req, res) => {
            try {
                const {
                    nombre,
                    descripcion,
                    precio,
                    categoriaId,
                    imagen
                } = req.body;

                const nombreLimpio = String(nombre || "").trim();
                const precioNumero = Number(precio);
                const categoria = Number(categoriaId);

                if (
                    !nombreLimpio ||
                    !Number.isFinite(precioNumero) ||
                    precioNumero <= 0 ||
                    !idValido(categoria)
                ) {
                    return res.status(400).json({
                        error: "Verifique el nombre, precio y categoría"
                    });
                }

                const [categorias] = await conexion.execute(
                    `SELECT id_categoria
                     FROM categoria
                     WHERE id_categoria = ?
                     AND activa = 1`,
                    [categoria]
                );

                if (categorias.length === 0) {
                    return res.status(400).json({
                        error: "La categoría seleccionada no existe o está inactiva"
                    });
                }

                const [resultado] = await conexion.execute(
                    `INSERT INTO producto
                    (id_categoria, nombre, descripcion, precio, imagen, disponible, activo)
                    VALUES (?, ?, ?, ?, ?, 1, 1)`,
                    [
                        categoria,
                        nombreLimpio,
                        descripcion || "",
                        precioNumero,
                        imagen || ""
                    ]
                );

                res.status(201).json({
                    mensaje: "Producto creado",
                    id: resultado.insertId
                });
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudo crear el producto"
                });
            }
        });

        // Editar producto
        app.put("/api/productos/:id", async (req, res) => {
            try {
                const id = Number(req.params.id);

                const {
                    nombre,
                    descripcion,
                    precio,
                    categoriaId,
                    imagen
                } = req.body;

                const nombreLimpio = String(nombre || "").trim();
                const precioNumero = Number(precio);
                const categoria = Number(categoriaId);

                if (
                    !idValido(id) ||
                    !nombreLimpio ||
                    !Number.isFinite(precioNumero) ||
                    precioNumero <= 0 ||
                    !idValido(categoria)
                ) {
                    return res.status(400).json({
                        error: "Datos del producto inválidos"
                    });
                }

                const [categorias] = await conexion.execute(
                    `SELECT id_categoria
                     FROM categoria
                     WHERE id_categoria = ?
                     AND activa = 1`,
                    [categoria]
                );

                if (categorias.length === 0) {
                    return res.status(400).json({
                        error: "La categoría no existe o está inactiva"
                    });
                }

                const [resultado] = await conexion.execute(
                    `UPDATE producto
                     SET id_categoria = ?,
                         nombre = ?,
                         descripcion = ?,
                         precio = ?,
                         imagen = ?
                     WHERE id_producto = ?
                     AND activo = 1`,
                    [
                        categoria,
                        nombreLimpio,
                        descripcion || "",
                        precioNumero,
                        imagen || "",
                        id
                    ]
                );

                if (resultado.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Producto no encontrado"
                    });
                }

                res.json({
                    mensaje: "Producto actualizado"
                });
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudo actualizar el producto"
                });
            }
        });

        // Dar de baja un producto
        app.delete("/api/productos/:id", async (req, res) => {
            try {
                const id = Number(req.params.id);

                if (!idValido(id)) {
                    return res.status(400).json({
                        error: "Identificador inválido"
                    });
                }

                const [resultado] = await conexion.execute(
                    `UPDATE producto
                     SET activo = 0
                     WHERE id_producto = ?
                     AND activo = 1`,
                    [id]
                );

                if (resultado.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Producto no encontrado"
                    });
                }

                res.json({
                    mensaje: "Producto dado de baja"
                });
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudo dar de baja el producto"
                });
            }
        });

        // Cambiar disponibilidad
        app.patch("/api/productos/:id/disponibilidad", async (req, res) => {
            try {
                const id = Number(req.params.id);

                if (!idValido(id)) {
                    return res.status(400).json({
                        error: "Identificador inválido"
                    });
                }

                const [resultado] = await conexion.execute(
                    `UPDATE producto
                     SET disponible = NOT disponible
                     WHERE id_producto = ?
                     AND activo = 1`,
                    [id]
                );

                if (resultado.affectedRows === 0) {
                    return res.status(404).json({
                        error: "Producto no encontrado"
                    });
                }

                res.json({
                    mensaje: "Disponibilidad actualizada"
                });
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudo cambiar la disponibilidad"
                });
            }
        });

// =========================
// ROLES
// =========================

// Consultar roles disponibles
app.get(
    "/api/roles",
    verificarToken,
    autorizarRoles("Administrador"),
    async (req, res) => {
        try {
            const roles = await usuariosService.listarRoles(conexion);
            res.json(roles);
        } catch (error) {
            console.error("Error al consultar roles:", error);
            res.status(500).json({
                error: "No se pudieron consultar los roles"
            });
        }
    }
);

// =========================
// USUARIOS
// =========================

// Consultar usuarios registrados
app.get("/api/usuarios", async (req, res) => {
    try {
        const usuarios = await usuariosService.listarUsuarios(conexion);
        res.json(usuarios);
    } catch (error) {
        console.error("Error al consultar usuarios:", error);
        res.status(500).json({
            error: "No se pudieron consultar los usuarios"
        });
    }
});

// Registrar usuario
app.post("/api/usuarios", async (req, res) => {
    try {
        const resultado = await usuariosService.registrarUsuario(
            conexion,
            req.body
        );

        res.status(201).json(resultado);

    } catch (error) {
        console.error("Error al registrar usuario:", error);

        if (
            error.message === "DATOS_INVALIDOS" ||
            error.message === "ROLES_INVALIDOS"
        ) {
            return res.status(400).json({
                error: "Verifique los datos y los roles seleccionados"
            });
        }

        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({
                error: "El correo o nombre de usuario ya está registrado"
            });
        }

        res.status(500).json({
            error: "No se pudo registrar el usuario"
        });
    }
});

        // =========================
        // INVENTARIO
        // =========================

        // Consultar insumos
        app.get("/api/inventario", async (req, res) => {
            try {
                const insumos = await inventarioService.listarInsumos(conexion);
                res.json(insumos);
            } catch (error) {
                console.error("Error al consultar inventario:", error);
                res.status(500).json({
                    error: "No se pudo consultar el inventario"
                });
            }
        });

        // Crear insumo
        app.post("/api/inventario", async (req, res) => {
            try {
                const id = await inventarioService.crearInsumo(
                    conexion,
                    req.body
                );

                res.status(201).json({
                    mensaje: "Insumo creado correctamente",
                    id
                });
            } catch (error) {
                console.error("Error al crear insumo:", error);
                res.status(400).json({
                    error: error.message
                });
            }
        });

        // Editar insumo
        app.put("/api/inventario/:id", async (req, res) => {
            try {
                const id = Number(req.params.id);

                if (!idValido(id)) {
                    return res.status(400).json({
                        error: "Identificador inválido"
                    });
                }

                const resultado = await inventarioService.actualizarInsumo(
                    conexion,
                    id,
                    req.body
                );

                res.json(resultado);
            } catch (error) {
                console.error("Error al actualizar insumo:", error);

                const estado = error.message === "El insumo no existe"
                    ? 404
                    : 400;

                res.status(estado).json({
                    error: error.message
                });
            }
        });

        // Registrar entrada, salida o ajuste
        app.post("/api/inventario/:id/movimientos", async (req, res) => {
            try {
                const id = Number(req.params.id);

                if (!idValido(id)) {
                    return res.status(400).json({
                        error: "Identificador inválido"
                    });
                }

                const resultado = await inventarioService.registrarMovimiento(
                    conexion,
                    {
                        ...req.body,
                        id_insumo: id,
                        id_usuario: req.usuario.id_usuario
                    }
                );

                res.status(201).json(resultado);
            } catch (error) {
                console.error("Error al registrar movimiento:", error);

                const estado = error.message === "El insumo no existe"
                    ? 404
                    : 400;

                res.status(estado).json({
                    error: error.message
                });
            }
        });

        // Consultar historial de movimientos
        app.get("/api/inventario/:id/movimientos", async (req, res) => {
            try {
                const id = Number(req.params.id);

                if (!idValido(id)) {
                    return res.status(400).json({
                        error: "Identificador inválido"
                    });
                }

                const movimientos = await inventarioService.listarMovimientos(
                    conexion,
                    id
                );

                res.json(movimientos);
            } catch (error) {
                console.error("Error al consultar movimientos:", error);
                res.status(500).json({
                    error: "No se pudo consultar el historial"
                });
            }
        });


        // =========================
        // INICIAR SERVIDOR
        // =========================
        // =========================

// =========================
// PEDIDOS
// =========================

// Consultar productos y mesas para el formulario
app.get("/api/pedidos/datos", verificarToken, async (req, res) => {
    try {
        const datos = await pedidosService.obtenerDatosFormulario(conexion);
        res.json(datos);
    } catch (error) {
        console.error("Error al consultar datos de pedidos:", error);
        res.status(500).json({
            error: "No se pudieron consultar los datos para pedidos"
        });
    }
});

// Consultar pedidos
app.get("/api/pedidos", verificarToken, async (req, res) => {
    try {
        const pedidos = await pedidosService.listarPedidos(conexion);
        res.json(pedidos);
    } catch (error) {
        console.error("Error al consultar pedidos:", error);
        res.status(500).json({
            error: "No se pudieron consultar los pedidos"
        });
    }
});


// Consultar un pedido específico
app.get("/api/pedidos/:id", verificarToken, async (req, res) => {
    try {
        const pedido = await pedidosService.obtenerPedido(
            conexion,
            Number(req.params.id)
        );
        res.json(pedido);
    } catch (error) {
        console.error("Error al consultar pedido:", error);
        res.status(404).json({ error: "No se pudo consultar el pedido" });
    }
});

// Crear pedido
app.post("/api/pedidos", verificarToken, async (req, res) => {
    try {
        const resultado = await pedidosService.crearPedido(
            conexion,
            {
                ...req.body,
                id_usuario: req.usuario.id_usuario
            }
        );
        res.status(201).json(resultado);
    } catch (error) {
        console.error("Error al crear pedido:", error);
        res.status(400).json({ error: error.message });
    }
});

// Editar pedido
app.put("/api/pedidos/:id", verificarToken, async (req, res) => {
    try {
        const resultado = await pedidosService.editarPedido(
            conexion,
            Number(req.params.id),
            req.body,
            req.usuario.id_usuario
        );
        res.json(resultado);
    } catch (error) {
        console.error("Error al editar pedido:", error);
        res.status(400).json({ error: error.message });
    }
});

// Eliminar producto de un pedido
app.delete("/api/pedidos/:id/productos/:idDetalle", verificarToken, async (req, res) => {
    try {
        const resultado = await pedidosService.eliminarProducto(
            conexion,
            Number(req.params.id),
            Number(req.params.idDetalle),
            req.usuario.id_usuario
        );
        res.json(resultado);
    } catch (error) {
        console.error("Error al eliminar producto:", error);
        res.status(400).json({ error: error.message });
    }
});

// Cambiar estado
app.patch("/api/pedidos/:id/estado", verificarToken, async (req, res) => {
    try {
        const resultado = await pedidosService.cambiarEstado(
            conexion,
            Number(req.params.id),
            req.body.estado,
            req.usuario.id_usuario
        );
        res.json(resultado);
    } catch (error) {
        console.error("Error al cambiar estado:", error);
        res.status(400).json({ error: error.message });
    }
});

// Cancelar pedido
app.patch("/api/pedidos/:id/cancelar", verificarToken, async (req, res) => {
    try {
        const resultado = await pedidosService.cancelarPedido(
            conexion,
            Number(req.params.id),
            req.usuario.id_usuario
        );
        res.json(resultado);
    } catch (error) {
        console.error("Error al cancelar pedido:", error);
        res.status(400).json({ error: error.message });
    }
});

// Consultar historial
app.get("/api/pedidos/:id/historial", verificarToken, async (req, res) => {
    try {
        const historial = await pedidosService.obtenerHistorial(
            conexion,
            Number(req.params.id)
        );
        res.json(historial);
    } catch (error) {
        console.error("Error al consultar historial:", error);
        res.status(400).json({ error: error.message });
    }
});

// MESAS
// =========================

app.use("/api/mesas", verificarToken);

// Consultar mesas
app.get("/api/mesas", async (req, res) => {
    try {
        const mesas = await mesasService.listar(conexion);
        res.json(mesas);
    } catch (error) {
        console.error("Error al consultar mesas:", error);
        res.status(500).json({ error: "No se pudieron consultar las mesas" });
    }
});

// Registrar mesa
app.post("/api/mesas", async (req, res) => {
    try {
        const id = await mesasService.crear(conexion, req.body);
        res.status(201).json({
            mensaje: "Mesa registrada correctamente",
            id
        });
    } catch (error) {
        console.error("Error al registrar mesa:", error);
        res.status(error.code === "ER_DUP_ENTRY" ? 409 : 400).json({
            error: error.code === "ER_DUP_ENTRY"
                ? "Ya existe una mesa con ese número"
                : error.message
        });
    }
});

// Editar mesa
app.put("/api/mesas/:id", async (req, res) => {
    try {
        await mesasService.actualizar(
            conexion,
            Number(req.params.id),
            req.body
        );

        res.json({ mensaje: "Mesa actualizada correctamente" });
    } catch (error) {
        console.error("Error al editar mesa:", error);

        const estado = error.message === "MESA_NO_ENCONTRADA" ? 404 :
            error.code === "ER_DUP_ENTRY" ? 409 : 400;

        res.status(estado).json({
            error: error.code === "ER_DUP_ENTRY"
                ? "Ya existe una mesa con ese número"
                : error.message === "MESA_NO_ENCONTRADA"
                    ? "Mesa no encontrada"
                    : error.message
        });
    }
});

// Cambiar estado
app.patch("/api/mesas/:id/estado", async (req, res) => {
    try {
        await mesasService.cambiarEstado(
            conexion,
            Number(req.params.id),
            req.body.estado
        );

        res.json({ mensaje: "Estado actualizado correctamente" });
    } catch (error) {
        console.error("Error al cambiar estado:", error);

        const estado = error.message === "MESA_NO_ENCONTRADA" ? 404 : 400;

        res.status(estado).json({ error: error.message });
    }
});
        app.listen(PORT, () => {
            console.log(`Servidor SIAR activo en puerto ${PORT}`);
        });

    } catch (error) {
        console.error("Error al iniciar SIAR:", error);
    }
}

iniciarServidor();