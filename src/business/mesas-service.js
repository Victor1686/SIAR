const mesasRepository = require("../data/mesas-repository");

const estados = ["Disponible", "Ocupada", "Reservada"];

function validarDatos(mesa) {
    const numero = Number(mesa.numero);
    const capacidad = Number(mesa.capacidad);
    const ubicacion = String(mesa.ubicacion || "").trim();

    if (!Number.isInteger(numero) || numero < 1) {
        throw new Error("El número de mesa debe ser positivo.");
    }

    if (!Number.isInteger(capacidad) || capacidad < 1) {
        throw new Error("La capacidad debe ser positiva.");
    }

    if (!ubicacion) {
        throw new Error("La ubicación es obligatoria.");
    }

    return { numero, capacidad, ubicacion };
}

async function listar(conexion) {
    return mesasRepository.listar(conexion);
}

async function crear(conexion, datos) {
    const mesa = validarDatos(datos);
    mesa.estado = "Disponible";

    return mesasRepository.crear(conexion, mesa);
}

async function actualizar(conexion, id, datos) {
    if (!Number.isInteger(id) || id < 1) {
        throw new Error("Identificador de mesa inválido.");
    }

    const mesa = validarDatos(datos);
    const resultado = await mesasRepository.actualizar(conexion, id, mesa);

    if (!resultado) {
        throw new Error("MESA_NO_ENCONTRADA");
    }

    return true;
}

async function cambiarEstado(conexion, id, estado) {
    if (!Number.isInteger(id) || id < 1) {
        throw new Error("Identificador de mesa inválido.");
    }

    if (!estados.includes(estado)) {
        throw new Error("Estado de mesa inválido.");
    }

    const resultado = await mesasRepository.cambiarEstado(conexion, id, estado);

    if (!resultado) {
        throw new Error("MESA_NO_ENCONTRADA");
    }

    return true;
}

module.exports = {
    listar,
    crear,
    actualizar,
    cambiarEstado
};