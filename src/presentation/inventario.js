
const API_URL = "http://localhost:3000/api/inventario";

let modalInventario;
let modalMovimiento;
let modalHistorial;

let tipoFormulario = "nuevo";
let idInsumoSeleccionado = null;
let tipoMovimientoSeleccionado = "Entrada";

let insumosInventario = [];

const tablaInventario = document.getElementById("listaInventario");

// =========================
// AUTENTICACIÓN
// =========================

function obtenerToken() {
    return localStorage.getItem("token");
}

// =========================
// SEGURIDAD HTML
// =========================

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

// =========================
// SOLICITUDES API
// =========================

async function solicitarAPI(ruta = "", opciones = {}) {
    const token = obtenerToken();

    if (!token) {
        throw new Error("No se encontró el token. Inicia sesión nuevamente.");
    }

    const respuesta = await fetch(`${API_URL}${ruta}`, {
        ...opciones,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(opciones.headers || {})
        }
    });

    const texto = await respuesta.text();

    let resultado = {};

    try {
        resultado = texto ? JSON.parse(texto) : {};
    } catch {
        resultado = { mensaje: texto };
    }

    if (!respuesta.ok) {
        throw new Error(
            resultado.mensaje ||
            resultado.error ||
            `Error del servidor (${respuesta.status})`
        );
    }

    return resultado;
}

// =========================
// MENSAJES
// =========================

function mostrarMensaje(contenedor, texto, tipo = "danger") {
    if (!contenedor) return;

    contenedor.textContent = texto;
    contenedor.className = `alert alert-${tipo}`;
}

function ocultarMensaje(contenedor) {
    if (!contenedor) return;

    contenedor.textContent = "";
    contenedor.className = "alert d-none";
}

// =========================
// CARGAR INVENTARIO
// =========================

async function cargarInventario() {
    try {
        const resultado = await solicitarAPI();

        insumosInventario = Array.isArray(resultado)
            ? resultado
            : resultado.insumos || resultado.data || [];

        renderizarInventario(insumosInventario);
        actualizarResumen(insumosInventario);

        ocultarMensaje(document.getElementById("mensajeInventario"));

    } catch (error) {
        tablaInventario.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    ${escaparHTML(error.message)}
                </td>
            </tr>
        `;

        mostrarMensaje(
            document.getElementById("mensajeInventario"),
            error.message
        );
    }
}

// =========================
// MOSTRAR INVENTARIO
// =========================

function renderizarInventario(insumos) {
    if (!insumos.length) {
        tablaInventario.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    No hay insumos registrados.
                </td>
            </tr>
        `;
        return;
    }

    tablaInventario.innerHTML = insumos.map(insumo => {
        const stock = Number(insumo.stock || 0);
        const minimo = Number(insumo.stock_minimo || 0);

        const bajo = stock <= minimo;

        return `
            <tr>
                <td>${Number(insumo.id_insumo)}</td>
                <td>${escaparHTML(insumo.nombre)}</td>
                <td>${escaparHTML(insumo.unidad_medida)}</td>
                <td>${stock.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</td>
                <td>${minimo.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</td>
                <td>
                    <span class="estado-stock ${bajo ? "stock-bajo" : "stock-normal"}">
                        ${bajo ? "Stock bajo" : "Disponible"}
                    </span>
                </td>
                <td>
                    <div class="acciones-tabla">

                        <button class="btn btn-primary"
                            data-accion="entrada"
                            data-id="${insumo.id_insumo}">
                            Entrada
                        </button>

                        <button class="btn btn-outline-danger"
                            data-accion="salida"
                            data-id="${insumo.id_insumo}">
                            Salida
                        </button>

                        <button class="btn btn-outline-secondary"
                            data-accion="historial"
                            data-id="${insumo.id_insumo}">
                            Historial
                        </button>

                        <button class="btn btn-secondary"
                            data-accion="editar"
                            data-id="${insumo.id_insumo}">
                            Editar
                        </button>

                    </div>
                </td>
            </tr>
        `;
    }).join("");
}

// =========================
// RESUMEN
// =========================

function actualizarResumen(insumos) {
    const total = insumos.length;

    const bajos = insumos.filter(insumo =>
        Number(insumo.stock || 0) <= Number(insumo.stock_minimo || 0)
    ).length;

    document.getElementById("totalInsumos").textContent = total;
    document.getElementById("insumosBajos").textContent = bajos;
    document.getElementById("insumosDisponibles").textContent = total - bajos;
}

// =========================
// NUEVO INSUMO
// =========================

function abrirFormularioNuevo() {
    tipoFormulario = "nuevo";
    idInsumoSeleccionado = null;

    const formulario = document.getElementById("formularioInventario");

    formulario.reset();

    document.getElementById("tituloModalInventario").textContent =
        "Registrar insumo";

    document.getElementById("campoStockInicial").classList.remove("d-none");
    document.getElementById("stockInicial").disabled = false;
    document.getElementById("stockInicial").value = "0";

    ocultarMensaje(document.getElementById("mensajeFormulario"));

    modalInventario.show();
}

// =========================
// EDITAR INSUMO
// =========================

function abrirFormularioEditar(insumo) {
    tipoFormulario = "editar";
    idInsumoSeleccionado = Number(insumo.id_insumo);

    document.getElementById("formularioInventario").reset();

    document.getElementById("tituloModalInventario").textContent =
        "Editar insumo";

    document.getElementById("nombreInsumo").value = insumo.nombre;
    document.getElementById("unidadMedida").value = insumo.unidad_medida;
    document.getElementById("stockMinimo").value = insumo.stock_minimo;

    // El stock actual no se modifica desde este formulario.
    document.getElementById("campoStockInicial").classList.add("d-none");

    ocultarMensaje(document.getElementById("mensajeFormulario"));

    modalInventario.show();
}

// =========================
// GUARDAR INSUMO
// =========================

async function guardarFormulario(evento) {
    evento.preventDefault();

    const nombre = document.getElementById("nombreInsumo").value.trim();
    const unidad = document.getElementById("unidadMedida").value;
    const minimo = Number(document.getElementById("stockMinimo").value);

    const stockInicial = Number(
        document.getElementById("stockInicial").value
    );

    const mensaje = document.getElementById("mensajeFormulario");

    if (!nombre || !unidad || !Number.isFinite(minimo) || minimo < 0) {
        mostrarMensaje(mensaje, "Completa los campos correctamente.");
        return;
    }

    if (tipoFormulario === "nuevo" &&
        (!Number.isFinite(stockInicial) || stockInicial < 0)) {
        mostrarMensaje(mensaje, "El stock inicial no es válido.");
        return;
    }

    const boton = document.getElementById("btnGuardarInsumo");
    boton.disabled = true;

    try {
        if (tipoFormulario === "nuevo") {
            await solicitarAPI("", {
                method: "POST",
                body: JSON.stringify({
                    nombre,
                    unidad_medida: unidad,
                    stock: stockInicial,
                    stock_minimo: minimo
                })
            });
        } else {
            if (!idInsumoSeleccionado) {
                throw new Error("No se identificó el insumo que deseas editar.");
            }

            await solicitarAPI(`/${idInsumoSeleccionado}`, {
                method: "PUT",
                body: JSON.stringify({
                    nombre,
                    unidad_medida: unidad,
                    stock_minimo: minimo
                })
            });
        }

        modalInventario.hide();
        await cargarInventario();

    } catch (error) {
        mostrarMensaje(mensaje, error.message);
    } finally {
        boton.disabled = false;
    }
}

// =========================
// MOVIMIENTOS
// =========================

function abrirMovimiento(id, tipo, nombre, unidad) {
    idInsumoSeleccionado = Number(id);

    const formulario = document.getElementById("formularioMovimiento");
    formulario.reset();

    tipoMovimientoSeleccionado =
        tipo === "entrada" ? "Entrada" : "Salida";

    document.getElementById("tituloModalMovimiento").textContent =
        `Movimiento: ${nombre}`;

    document.getElementById("nombreMovimiento").value = nombre;
    document.getElementById("unidadMovimiento").value = unidad;

    document.getElementById("tipoMovimiento").value =
        tipoMovimientoSeleccionado;

    document.getElementById("cantidadMovimiento").value = "";

    ocultarMensaje(document.getElementById("mensajeMovimiento"));

    modalMovimiento.show();
}

// =========================
// GUARDAR MOVIMIENTO
// =========================

async function guardarMovimiento(evento) {
    evento.preventDefault();

    const cantidad = Number(
        document.getElementById("cantidadMovimiento").value
    );

    const tipo = document.getElementById("tipoMovimiento").value;

    const mensaje = document.getElementById("mensajeMovimiento");

    if (!tipo || !["Entrada", "Salida", "Ajuste"].includes(tipo)) {
        mostrarMensaje(mensaje, "Selecciona un tipo de movimiento válido.");
        return;
    }

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
        mostrarMensaje(mensaje, "Ingresa una cantidad mayor que cero.");
        return;
    }

    const boton = document.getElementById("btnGuardarMovimiento");
    boton.disabled = true;

    try {
        await solicitarAPI(`/${idInsumoSeleccionado}/movimientos`, {
            method: "POST",
            body: JSON.stringify({
                tipo,
                cantidad
            })
        });

        modalMovimiento.hide();
        await cargarInventario();

    } catch (error) {
        mostrarMensaje(mensaje, error.message);
    } finally {
        boton.disabled = false;
    }
}

// =========================
// HISTORIAL
// =========================

async function abrirHistorial(insumo) {
    const titulo = document.getElementById("tituloHistorial");
    const lista = document.getElementById("listaMovimientos");
    const mensaje = document.getElementById("mensajeHistorial");

    titulo.textContent = `Historial: ${insumo.nombre}`;

    ocultarMensaje(mensaje);

    lista.innerHTML = `
        <tr>
            <td colspan="4" class="text-center">
                Consultando movimientos...
            </td>
        </tr>
    `;

    modalHistorial.show();

    try {
        const resultado = await solicitarAPI(
            `/${insumo.id_insumo}/movimientos`
        );

        const movimientos = Array.isArray(resultado)
            ? resultado
            : resultado.movimientos || resultado.data || [];

        if (!movimientos.length) {
            lista.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center">
                        Este insumo todavía no tiene movimientos registrados.
                    </td>
                </tr>
            `;
            return;
        }

        lista.innerHTML = movimientos.map(movimiento => {
            const fecha = movimiento.fecha_hora
                ? new Date(
                    String(movimiento.fecha_hora).replace(" ", "T")
                ).toLocaleString("es-CO")
                : "Sin fecha";

            return `
                <tr>
                    <td>${escaparHTML(movimiento.tipo)}</td>
                    <td>${Number(movimiento.cantidad).toLocaleString("es-CO", {
                        maximumFractionDigits: 2
                    })}</td>
                    <td>${escaparHTML(movimiento.usuario || "No disponible")}</td>
                    <td>${escaparHTML(fecha)}</td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        lista.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-danger">
                    No se pudo cargar el historial.
                </td>
            </tr>
        `;

        mostrarMensaje(mensaje, error.message);
    }
}

// =========================
// EVENTOS DE LA TABLA
// =========================

function configurarEventosTabla() {
    tablaInventario.addEventListener("click", evento => {
        const boton = evento.target.closest("button[data-accion]");

        if (!boton) return;

        const accion = boton.dataset.accion;
        const id = Number(boton.dataset.id);

        const insumo = insumosInventario.find(
            elemento => Number(elemento.id_insumo) === id
        );

        if (!insumo) return;

        if (accion === "historial") {
            abrirHistorial(insumo);

        } else if (accion === "entrada" || accion === "salida") {
            abrirMovimiento(
                insumo.id_insumo,
                accion,
                insumo.nombre,
                insumo.unidad_medida
            );

        } else if (accion === "editar") {
            abrirFormularioEditar(insumo);
        }
    });
}

// =========================
// INICIALIZAR
// =========================

document.addEventListener("DOMContentLoaded", () => {
    modalInventario = new bootstrap.Modal(
        document.getElementById("modalInventario")
    );

    modalMovimiento = new bootstrap.Modal(
        document.getElementById("modalMovimiento")
    );

    modalHistorial = new bootstrap.Modal(
        document.getElementById("modalHistorial")
    );

    document.getElementById("btnNuevoInsumo")
        .addEventListener("click", abrirFormularioNuevo);

    document.getElementById("formularioInventario")
        .addEventListener("submit", guardarFormulario);

    document.getElementById("formularioMovimiento")
        .addEventListener("submit", guardarMovimiento);

    configurarEventosTabla();

    cargarInventario();
});
