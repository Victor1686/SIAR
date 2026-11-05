// Servicio del modulo de pedidos

// Consultar todos los pedidos
async function listarPedidos(conexion) {
    const [pedidos] = await conexion.execute(
        `SELECT
            id_pedido,
            id_mesa,
            id_usuario,
            fecha_hora,
            hora_envio_cocina,
            estado,
            total
         FROM pedido
         ORDER BY fecha_hora DESC`
    );

    return pedidos;
}

// Exportar funciones
module.exports = {
    listarPedidos
};