const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("./config/env");
const pedidosService = require("./business/pedidos-service");
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
        if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
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
        conexion = await mysql.createConnection(dbConfig);

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
             WHERE u.usuario = ?
             LIMIT 1`,
            [usuario]
        );

        if (usuarios.length === 0 || usuarios[0].activo !== 1) {
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

        const token = jwt.sign(
            {
                id_usuario: datosUsuario.id_usuario,
                usuario: datosUsuario.usuario,
                rol: datosUsuario.rol,
                permisos: datosUsuario.permisos
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
                rol: datosUsuario.rol,
                permisos: datosUsuario.permisos
            }
        });
    } catch (error) {
console.error("ERROR COMPLETO DEL LOGIN:", error);
console.error(error.stack);
        res.status(500).json({
            error: "No se pudo iniciar sesión"
        });
    }
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
        // USUARIOS
        // =========================

                app.get("/api/usuarios", async (req, res) => {
            try {
                const [usuarios] = await conexion.execute(
                    `SELECT id_usuario, nombre, correo, usuario
                     FROM usuario`
                );

                res.json(usuarios);
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudieron consultar los usuarios"
                });
            }
        });

        // =========================
        // INICIAR SERVIDOR
        // =========================

        app.listen(PORT, () => {
            console.log(`Servidor SIAR activo en puerto ${PORT}`);
        });

    } catch (error) {
        console.error("Error al iniciar SIAR:", error);
    }
}

iniciarServidor();