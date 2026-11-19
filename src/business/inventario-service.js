
const inventarioRepository = require('../data/inventario-repository');

async function listarInsumos(conexion) {
    return await inventarioRepository.listarInsumos(conexion);
}

async function crearInsumo(conexion, datos) {
    if (!datos.nombre || !datos.unidad_medida) {
        throw new Error('El nombre y la unidad de medida son obligatorios');
    }

    const stock = Number(datos.stock ?? 0);
    const stockMinimo = Number(datos.stock_minimo ?? 0);

    if (
        !Number.isFinite(stock) ||
        !Number.isFinite(stockMinimo) ||
        stock < 0 ||
        stockMinimo < 0
    ) {
        throw new Error('El stock no puede ser negativo');
    }

    return await inventarioRepository.crearInsumo(conexion, {
        nombre: datos.nombre.trim(),
        unidad_medida: datos.unidad_medida.trim(),
        stock,
        stock_minimo: stockMinimo
    });
}

async function registrarMovimiento(conexion, datos) {
    const idInsumo = Number(datos.id_insumo);
    const idUsuario = Number(datos.id_usuario);
    const cantidad = Number(datos.cantidad);

    if (
        !Number.isInteger(idInsumo) || idInsumo <= 0 ||
        !Number.isInteger(idUsuario) || idUsuario <= 0 ||
        !Number.isFinite(cantidad) || cantidad <= 0
    ) {
        throw new Error('Datos del movimiento inválidos');
    }

    if (!['Entrada', 'Salida', 'Ajuste'].includes(datos.tipo)) {
        throw new Error('Tipo de movimiento inválido');
    }

    const conexionTransaccion = await conexion.getConnection();

    try {
        await conexionTransaccion.beginTransaction();

        const insumo = await inventarioRepository.obtenerInsumo(
            conexionTransaccion,
            idInsumo
        );

        if (!insumo) {
            throw new Error('El insumo no existe');
        }

        let nuevoStock;

        if (datos.tipo === 'Entrada') {
            nuevoStock = Number(insumo.stock) + cantidad;
        } else if (datos.tipo === 'Salida') {
            nuevoStock = Number(insumo.stock) - cantidad;

            if (nuevoStock < 0) {
                throw new Error('No hay suficiente stock');
            }
        } else {
            nuevoStock = cantidad;
        }

        await inventarioRepository.actualizarStock(
            conexionTransaccion,
            idInsumo,
            nuevoStock
        );

        await inventarioRepository.registrarMovimiento(
            conexionTransaccion,
            {
                id_insumo: idInsumo,
                id_usuario: idUsuario,
                id_pedido: datos.id_pedido ?? null,
                tipo: datos.tipo,
                cantidad
            }
        );

        await conexionTransaccion.commit();

        return {
            mensaje: 'Movimiento registrado',
            stock: nuevoStock
        };

    } catch (error) {
        await conexionTransaccion.rollback();
        throw error;
    } finally {
        conexionTransaccion.release();
    }
}

async function listarMovimientos(conexion, idInsumo) {
    return await inventarioRepository.listarMovimientos(
        conexion,
        idInsumo
    );
}

async function actualizarInsumo(conexion, id, datos) {
    const nombre = String(datos.nombre || '').trim();
    const unidad = String(datos.unidad_medida || '').trim();
    const stockMinimo = Number(datos.stock_minimo);

    if (!id || !nombre || !unidad) {
        throw new Error('Todos los campos son obligatorios');
    }

    if (!Number.isFinite(stockMinimo) || stockMinimo < 0) {
        throw new Error('El stock mínimo no es válido');
    }

    const insumo = await inventarioRepository.obtenerInsumo(
        conexion,
        id
    );

    if (!insumo) {
        throw new Error('El insumo no existe');
    }

    await inventarioRepository.actualizarInsumo(conexion, id, {
        nombre,
        unidad_medida: unidad,
        stock_minimo: stockMinimo
    });

    return {
        mensaje: 'Insumo actualizado correctamente'
    };
}

module.exports = {
    listarInsumos,
    crearInsumo,
    registrarMovimiento,
    listarMovimientos,
    actualizarInsumo
};
