
const pedidosRepository = require("../data/pedidos-repository");

const ESTADOS = [
    "Pendiente",
    "En preparación",
    "Listo",
    "Entregado",
    "Facturado",
    "Cancelado"
];

const ESTADOS_FINALIZADOS = ["Facturado", "Cancelado"];

// Validar identificadores
function validarId(id) {
    return Number.isInteger(Number(id)) && Number(id) > 0;
}

// Validar cantidad
function validarCantidad(cantidad) {
    return Number.isInteger(Number(cantidad)) && Number(cantidad) > 0;
}

// Obtener pedido y bloquearlo durante una transacción
async function obtenerPedidoBloqueado(conexion, idPedido) {
    const [pedidos] = await conexion.execute(
        `SELECT *
         FROM pedido
         WHERE id_pedido = ?
         FOR UPDATE`,
        [idPedido]
    );

    if (!pedidos.length) {
        throw new Error("PEDIDO_NO_EXISTE");
    }

    if (ESTADOS_FINALIZADOS.includes(pedidos[0].estado)) {
        throw new Error("PEDIDO_FINALIZADO");
    }

    return pedidos[0];
}

// Validar usuario activo
async function validarUsuario(conexion, idUsuario) {
    if (!validarId(idUsuario)) {
        throw new Error("USUARIO_INVALIDO");
    }

    const [usuarios] = await conexion.execute(
        `SELECT id_usuario
         FROM usuario
         WHERE id_usuario = ? AND activo = 1`,
        [idUsuario]
    );

    if (!usuarios.length) {
        throw new Error("USUARIO_NO_EXISTE");
    }
}

// Registrar auditoría
async function registrarAccion(
    conexion,
    idUsuario,
    accion,
    idPedido,
    detalle
) {
    await pedidosRepository.registrarAuditoria(conexion, {
        id_usuario: idUsuario,
        accion,
        entidad: "pedido",
        id_entidad: idPedido,
        detalle
    });
}

// Liberar mesa si no tiene otros pedidos activos
async function liberarMesaSiCorresponde(conexion, idMesa, idPedido) {
    const tieneActivos = await pedidosRepository.tienePedidosActivos(
        conexion,
        idMesa,
        idPedido
    );

    if (!tieneActivos) {
        await pedidosRepository.actualizarMesaEstado(
            conexion,
            idMesa,
            "Disponible"
        );
    }
}

// Listar pedidos
async function listarPedidos(conexion) {
    return await pedidosRepository.listarPedidos(conexion);
}

// Consultar pedido y sus productos
async function obtenerPedido(conexion, idPedido) {
    if (!validarId(idPedido)) {
        throw new Error("ID_INVALIDO");
    }

    const pedido = await pedidosRepository.obtenerPedido(
        conexion,
        idPedido
    );

    if (!pedido) {
        throw new Error("PEDIDO_NO_EXISTE");
    }

    pedido.productos = await pedidosRepository.listarDetallesPedido(
        conexion,
        idPedido
    );

    return pedido;
}

// Obtener productos y mesas para el formulario
async function obtenerDatosFormulario(conexion) {
    const [productos, mesas] = await Promise.all([
        pedidosRepository.listarProductosDisponibles(conexion),
        pedidosRepository.listarMesas(conexion)
    ]);

    return { productos, mesas };
}

// Consultar historial de un pedido
async function obtenerHistorial(conexion, idPedido) {
    if (!validarId(idPedido)) {
        throw new Error("ID_INVALIDO");
    }

    const pedido = await pedidosRepository.obtenerPedido(
        conexion,
        idPedido
    );

    if (!pedido) {
        throw new Error("PEDIDO_NO_EXISTE");
    }

    return await pedidosRepository.listarAuditoriaPedido(
        conexion,
        idPedido
    );
}

// Crear pedido con varios productos
async function crearPedido(conexion, datos) {
    const idMesa = Number(datos.id_mesa);
    const idUsuario = Number(datos.id_usuario);

    if (
        !validarId(idMesa) ||
        !validarId(idUsuario) ||
        !Array.isArray(datos.productos) ||
        datos.productos.length === 0
    ) {
        throw new Error("DATOS_INVALIDOS");
    }

    const connection = await conexion.getConnection();

    try {
        await connection.beginTransaction();

        await validarUsuario(connection, idUsuario);

        const [mesas] = await connection.execute(
            `SELECT id_mesa, estado
             FROM mesa
             WHERE id_mesa = ?
             FOR UPDATE`,
            [idMesa]
        );

        if (!mesas.length || mesas[0].estado !== "Disponible") {
            throw new Error("MESA_NO_DISPONIBLE");
        }

        const idPedido = await pedidosRepository.crearPedido(
            connection,
            {
                id_mesa: idMesa,
                id_usuario: idUsuario
            }
        );

        for (const item of datos.productos) {
            const idProducto = Number(item.id_producto);
            const cantidad = Number(item.cantidad);

            if (!validarId(idProducto) || !validarCantidad(cantidad)) {
                throw new Error("PRODUCTO_INVALIDO");
            }

            const producto =
                await pedidosRepository.obtenerProductoDisponible(
                    connection,
                    idProducto
                );

            if (!producto) {
                throw new Error("PRODUCTO_NO_DISPONIBLE");
            }

            await pedidosRepository.agregarDetalle(connection, {
                id_pedido: idPedido,
                id_producto: idProducto,
                cantidad,
                precio_unitario: producto.precio,
                observacion: item.observacion || null
            });
        }

        await pedidosRepository.actualizarTotalPedido(
            connection,
            idPedido
        );

        await pedidosRepository.actualizarMesaEstado(
            connection,
            idMesa,
            "Ocupada"
        );

        await registrarAccion(
            connection,
            idUsuario,
            "CREACION",
            idPedido,
            "Se creó el pedido con sus productos iniciales."
        );

        await connection.commit();

        return {
            mensaje: "Pedido creado correctamente",
            id_pedido: idPedido
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

// Editar pedido y agregar productos nuevos
async function editarPedido(conexion, idPedido, datos, idUsuario) {
    if (
        !validarId(idPedido) ||
        !Array.isArray(datos.productos) ||
        datos.productos.length === 0
    ) {
        throw new Error("DATOS_INVALIDOS");
    }

    const connection = await conexion.getConnection();

    try {
        await connection.beginTransaction();

        await validarUsuario(connection, idUsuario);

        const pedido = await obtenerPedidoBloqueado(
            connection,
            idPedido
        );

        for (const item of datos.productos) {
            const cantidad = Number(item.cantidad);

            if (!validarCantidad(cantidad)) {
                throw new Error("PRODUCTO_INVALIDO");
            }

            if (item.id_detalle !== undefined) {
                if (!validarId(item.id_detalle)) {
                    throw new Error("PRODUCTO_INVALIDO");
                }

                const detalle =
                    await pedidosRepository.obtenerDetallePedido(
                        connection,
                        idPedido,
                        item.id_detalle
                    );

                if (!detalle) {
                    throw new Error("DETALLE_NO_EXISTE");
                }

                await pedidosRepository.actualizarDetallePedido(
                    connection,
                    idPedido,
                    item.id_detalle,
                    {
                        cantidad,
                        observacion: item.observacion || null
                    }
                );

            } else if (validarId(item.id_producto)) {
                const producto =
                    await pedidosRepository.obtenerProductoDisponible(
                        connection,
                        Number(item.id_producto)
                    );

                if (!producto) {
                    throw new Error("PRODUCTO_NO_DISPONIBLE");
                }

                await pedidosRepository.agregarDetalle(connection, {
                    id_pedido: idPedido,
                    id_producto: producto.id_producto,
                    cantidad,
                    precio_unitario: producto.precio,
                    observacion: item.observacion || null
                });

            } else {
                throw new Error("PRODUCTO_INVALIDO");
            }
        }

        await pedidosRepository.actualizarTotalPedido(
            connection,
            idPedido
        );

        await registrarAccion(
            connection,
            idUsuario,
            "EDICION",
            idPedido,
            "Se modificaron productos o cantidades del pedido."
        );

        await connection.commit();

        return {
            mensaje: "Pedido actualizado correctamente",
            id_pedido: Number(idPedido)
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

// Eliminar un producto de un pedido
async function eliminarProducto(conexion, idPedido, idDetalle, idUsuario) {
    if (
        !validarId(idPedido) ||
        !validarId(idDetalle)
    ) {
        throw new Error("DATOS_INVALIDOS");
    }

    const connection = await conexion.getConnection();

    try {
        await connection.beginTransaction();

        await validarUsuario(connection, idUsuario);

        await obtenerPedidoBloqueado(connection, idPedido);

        const detalles = await pedidosRepository.listarDetallesPedido(
            connection,
            idPedido
        );

        const detalle = await pedidosRepository.obtenerDetallePedido(
            connection,
            idPedido,
            idDetalle
        );

        if (!detalle) {
            throw new Error("DETALLE_NO_EXISTE");
        }

        if (detalles.length <= 1) {
            throw new Error("ULTIMO_PRODUCTO");
        }

        await pedidosRepository.eliminarDetallePedido(
            connection,
            idPedido,
            idDetalle
        );

        await pedidosRepository.actualizarTotalPedido(
            connection,
            idPedido
        );

        await registrarAccion(
            connection,
            idUsuario,
            "ELIMINACION_PRODUCTO",
            idPedido,
            `Se eliminó el detalle ${idDetalle} del pedido.`
        );

        await connection.commit();

        return {
            mensaje: "Producto eliminado correctamente"
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

// Cambiar estado del pedido
async function cambiarEstado(conexion, idPedido, estado, idUsuario) {
    if (
        !validarId(idPedido) ||
        !ESTADOS.includes(estado)
    ) {
        throw new Error("DATOS_INVALIDOS");
    }

    if (estado === "Cancelado") {
        return await cancelarPedido(
            conexion,
            idPedido,
            idUsuario
        );
    }

    const connection = await conexion.getConnection();

    try {
        await connection.beginTransaction();

        await validarUsuario(connection, idUsuario);

        const pedido = await obtenerPedidoBloqueado(
            connection,
            idPedido
        );

        if (estado === "Facturado" && pedido.estado !== "Entregado") {
            throw new Error("ESTADO_NO_PERMITIDO");
        }

        await pedidosRepository.actualizarEstadoPedido(
            connection,
            idPedido,
            estado
        );

        if (estado === "En preparación" && !pedido.hora_envio_cocina) {
            await connection.execute(
                `UPDATE pedido
                 SET hora_envio_cocina = CURRENT_TIMESTAMP
                 WHERE id_pedido = ?`,
                [idPedido]
            );
        }

        if (estado === "Facturado") {
            await liberarMesaSiCorresponde(
                connection,
                pedido.id_mesa,
                idPedido
            );
        }

        await registrarAccion(
            connection,
            idUsuario,
            "CAMBIO_ESTADO",
            idPedido,
            `El estado cambió de ${pedido.estado} a ${estado}.`
        );

        await connection.commit();

        return {
            mensaje: "Estado actualizado correctamente",
            estado
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

// Cancelar pedido
async function cancelarPedido(conexion, idPedido, idUsuario) {
    if (!validarId(idPedido)) {
        throw new Error("DATOS_INVALIDOS");
    }

    const connection = await conexion.getConnection();

    try {
        await connection.beginTransaction();

        await validarUsuario(connection, idUsuario);

        const pedido = await obtenerPedidoBloqueado(
            connection,
            idPedido
        );

        await pedidosRepository.actualizarEstadoPedido(
            connection,
            idPedido,
            "Cancelado"
        );

        await liberarMesaSiCorresponde(
            connection,
            pedido.id_mesa,
            idPedido
        );

        await registrarAccion(
            connection,
            idUsuario,
            "CANCELACION",
            idPedido,
            "Se canceló el pedido."
        );

        await connection.commit();

        return {
            mensaje: "Pedido cancelado correctamente"
        };

    } catch (error) {
        await connection.rollback();
        throw error;

    } finally {
        connection.release();
    }
}

module.exports = {
    listarPedidos,
    obtenerPedido,
    obtenerDatosFormulario,
    obtenerHistorial,
    crearPedido,
    editarPedido,
    eliminarProducto,
    cambiarEstado,
    cancelarPedido
};
