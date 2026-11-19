
const Pedidos = (() => {
    const API = "http://localhost:3000/api/pedidos";

    let pedidos = [];
    let productos = [];
    let mesas = [];

    const $ = id => document.getElementById(id);

    const dinero = valor =>
        "$" + Number(valor || 0).toLocaleString("es-CO");

    const escapar = texto => String(texto ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));

    // CONEXIÓN CON EL BACKEND
    async function solicitar(ruta, opciones = {}) {
        try {
            const token = localStorage.getItem("token");

            if (!token) {
                throw new Error("No hay una sesión iniciada.");
            }

            const respuesta = await fetch(`${API}${ruta}`, {
                ...opciones,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                    ...(opciones.headers || {})
                }
            });

            const datos = await respuesta.json().catch(() => ({}));

            if (!respuesta.ok) {
                throw new Error(datos.error || "Error en la solicitud.");
            }

            return datos;

        } catch (error) {
            if (error.message.includes("Failed to fetch")) {
                throw new Error("No se pudo conectar con el servidor SIAR.");
            }

            throw error;
        }
    }

    function aviso(mensaje, correcto = true) {
        const alerta = $("alerta");

        if (!alerta) {
            alert(mensaje);
            return;
        }

        alerta.className = `alert alert-${correcto ? "success" : "danger"}`;
        alerta.textContent = mensaje;
        alerta.classList.remove("d-none");
    }

    // CARGAR DATOS
    async function cargarDatos() {
        const datos = await solicitar("/datos");

        productos = datos.productos || [];
        mesas = datos.mesas || [];
    }

    async function cargarPedidos() {
        pedidos = await solicitar("");
        mostrarPedidos();
        actualizarResumen();
    }

    // MOSTRAR PEDIDOS
    function mostrarPedidos() {
        const tabla = $("listaPedidos");

        if (!tabla) return;

        if (!pedidos.length) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        No hay pedidos registrados.
                    </td>
                </tr>
            `;
            return;
        }

        tabla.innerHTML = pedidos.map(p => `
            <tr>
                <td>${p.id_pedido}</td>
                <td>${escapar(p.numero_mesa ?? p.id_mesa ?? "-")}</td>
                <td>${escapar(p.nombre_usuario ?? "-")}</td>
                <td>${new Date(p.fecha_hora).toLocaleString("es-CO")}</td>
                <td>${dinero(p.total)}</td>
                <td>
                    <span class="badge ${claseEstado(p.estado)}">
                        ${escapar(p.estado)}
                    </span>
                </td>
                <td class="text-nowrap">
                    <button class="btn btn-sm btn-outline-primary"
                        onclick="Pedidos.ver(${p.id_pedido})">
                        Ver
                    </button>

                    <button class="btn btn-sm btn-outline-warning"
                        onclick="Pedidos.editar(${p.id_pedido})">
                        Editar
                    </button>

                    <button class="btn btn-sm btn-outline-success"
                        onclick="Pedidos.cambiarEstado(${p.id_pedido})">
                        Estado
                    </button>

                    <button class="btn btn-sm btn-outline-danger"
                        onclick="Pedidos.cancelar(${p.id_pedido})">
                        Cancelar
                    </button>
                </td>
            </tr>
        `).join("");
    }

    function claseEstado(estado) {
        const clases = {
            "Pendiente": "bg-warning text-dark",
            "En preparación": "bg-primary",
            "Listo": "bg-success",
            "Entregado": "bg-info text-dark",
            "Facturado": "bg-secondary",
            "Cancelado": "bg-danger"
        };

        return clases[estado] || "bg-secondary";
    }

    function actualizarResumen() {
        const total = pedidos.length;

        const pendientes = pedidos.filter(
            p => p.estado === "Pendiente"
        ).length;

        const preparando = pedidos.filter(
            p => p.estado === "En preparación"
        ).length;

        const listos = pedidos.filter(
            p => p.estado === "Listo"
        ).length;

        if ($("totalPedidos")) $("totalPedidos").textContent = total;
        if ($("pedidosPendientes")) $("pedidosPendientes").textContent = pendientes;
        if ($("pedidosPreparando")) $("pedidosPreparando").textContent = preparando;
        if ($("pedidosListos")) $("pedidosListos").textContent = listos;
    }

    
// CREAR PEDIDO
function crear() {
    const mesasDisponibles = mesas.filter(
        m => m.estado === "Disponible"
    );

    if (!mesasDisponibles.length) {
        aviso("No hay mesas disponibles.", false);
        return;
    }

    if (!productos.length) {
        aviso("No hay productos disponibles.", false);
        return;
    }

    $("mesaPedido").innerHTML = `
        <option value="">Seleccionar mesa</option>
        ${mesasDisponibles.map(m => `
            <option value="${m.id_mesa}">Mesa ${m.numero}</option>
        `).join("")}
    `;

    $("productosPedido").innerHTML = "";
    $("errorPedido").classList.add("d-none");

    agregarProductoPedido();

    bootstrap.Modal.getOrCreateInstance(
        $("modalPedido")
    ).show();
}


    // AGREGAR PRODUCTO AL FORMULARIO
    function agregarProductoPedido() {
        const contenedor = $("productosPedido");

        const fila = document.createElement("div");
        fila.className = "row g-2 align-items-end mb-3 border-bottom pb-3";

        fila.innerHTML = `
            <div class="col-md-5">
                <label class="form-label">Producto</label>
                <select class="form-select producto-seleccionado">
                    <option value="">Seleccionar producto</option>
                    ${productos.map(p => `
                        <option value="${p.id_producto}">
                            ${escapar(p.nombre)} - ${dinero(p.precio)}
                        </option>
                    `).join("")}
                </select>
            </div>

            <div class="col-md-2">
                <label class="form-label">Cantidad</label>
                <input type="number" class="form-control cantidad-producto"
                    min="1" value="1">
            </div>

            <div class="col-md-3">
                <label class="form-label">Observación</label>
                <input type="text" class="form-control observacion-producto"
                    placeholder="Opcional">
            </div>

            <div class="col-md-2">
                <button type="button" class="btn btn-outline-danger w-100"
                    onclick="this.closest('.row').remove(); calcularTotalPedido();">
                    Quitar
                </button>
            </div>
        `;

        contenedor.appendChild(fila);

        fila.querySelectorAll("select, input").forEach(campo => {
            campo.addEventListener("change", calcularTotalPedido);
            campo.addEventListener("input", calcularTotalPedido);
        });

        calcularTotalPedido();
    }

    // GUARDAR NUEVO PEDIDO
    async function guardarNuevoPedido() {
        try {
            const idMesa = Number($("mesaPedido").value);
            const filas = document.querySelectorAll("#productosPedido .row");
            const listaProductos = [];

            if (!idMesa) {
                throw new Error("Selecciona una mesa.");
            }

            filas.forEach(fila => {
                const idProducto = Number(
                    fila.querySelector(".producto-seleccionado").value
                );

                const cantidad = Number(
                    fila.querySelector(".cantidad-producto").value
                );

                const observacion = fila.querySelector(
                    ".observacion-producto"
                ).value.trim();

                if (!idProducto || !Number.isInteger(cantidad) || cantidad <= 0) {
                    throw new Error("Revisa los productos y sus cantidades.");
                }

                listaProductos.push({
                    id_producto: idProducto,
                    cantidad,
                    observacion
                });
            });

            if (!listaProductos.length) {
                throw new Error("Agrega al menos un producto.");
            }

            await solicitar("", {
                method: "POST",
                body: JSON.stringify({
                    id_mesa: idMesa,
                    productos: listaProductos
                })
            });

            bootstrap.Modal.getInstance($("modalPedido")).hide();

            aviso("Pedido creado correctamente.");
            await cargarPedidos();
            await cargarDatos();

        } catch (error) {
            $("errorPedido").textContent = error.message;
            $("errorPedido").classList.remove("d-none");
        }
    }

    // CALCULAR TOTAL DEL PEDIDO
    function calcularTotalPedido() {
        let total = 0;

        document.querySelectorAll("#productosPedido .row").forEach(fila => {
            const id = Number(fila.querySelector(".producto-seleccionado").value);
            const cantidad = Number(fila.querySelector(".cantidad-producto").value);

            const producto = productos.find(p => p.id_producto === id);

            if (producto && cantidad > 0) {
                total += Number(producto.precio) * cantidad;
            }
        });

        $("totalNuevoPedido").textContent = dinero(total);
    }

    // CONSULTAR PEDIDO
    async function ver(id) {
        try {
            const pedido = await solicitar(`/${id}`);

            const detalles = pedido.productos || [];

            let mensaje = `PEDIDO #${pedido.id_pedido}\n`;
            mensaje += `Estado: ${pedido.estado}\n`;
            mensaje += `Total: ${dinero(pedido.total)}\n\n`;
            mensaje += "PRODUCTOS:\n";

            detalles.forEach(p => {
                mensaje += `${p.nombre_producto || p.nombre} x${p.cantidad} - ${dinero(p.subtotal)}\n`;
            });

            alert(mensaje);

        } catch (error) {
            aviso(error.message, false);
        }
    }

    // EDITAR PEDIDO
    async function editar(id) {
        try {
            const pedido = await solicitar(`/${id}`);

            if (["Facturado", "Cancelado"].includes(pedido.estado)) {
                aviso("No se puede editar un pedido finalizado.", false);
                return;
            }

            const detalles = pedido.productos || [];

            if (!detalles.length) {
                aviso("Este pedido no tiene productos.", false);
                return;
            }

            const idDetalle = Number(prompt(
                "ID del detalle que deseas modificar:\n" +
                detalles.map(p =>
                    `${p.id_detalle} - ${p.nombre_producto || p.nombre} x${p.cantidad}`
                ).join("\n")
            ));

            const detalle = detalles.find(
                p => p.id_detalle === idDetalle
            );

            if (!detalle) {
                aviso("Detalle no válido.", false);
                return;
            }

            const cantidad = Number(prompt(
                "Nueva cantidad:",
                detalle.cantidad
            ));

            if (!Number.isInteger(cantidad) || cantidad <= 0) {
                aviso("La cantidad debe ser mayor que cero.", false);
                return;
            }

            const observacion = prompt(
                "Nueva observación:",
                detalle.observacion || ""
            );

            await solicitar(`/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    productos: [{
                        id_detalle: idDetalle,
                        cantidad,
                        observacion: observacion || ""
                    }]
                })
            });

            aviso("Pedido actualizado correctamente.");
            await cargarPedidos();

        } catch (error) {
            aviso(error.message, false);
        }
    }

    // ELIMINAR PRODUCTO DE UN PEDIDO
    async function eliminarProducto(idPedido, idDetalle) {
        try {
            if (!confirm("¿Deseas eliminar este producto del pedido?")) return;

            await solicitar(`/${idPedido}/productos/${idDetalle}`, {
                method: "DELETE"
            });

            aviso("Producto eliminado correctamente.");
            await cargarPedidos();

        } catch (error) {
            aviso(error.message, false);
        }
    }

    // CAMBIAR ESTADO
    async function cambiarEstado(id) {
        try {
            const pedido = await solicitar(`/${id}`);

            const estados = [
                "Pendiente",
                "En preparación",
                "Listo",
                "Entregado",
                "Facturado"
            ];

            const nuevoEstado = prompt(
                `Estado actual: ${pedido.estado}\n\n` +
                `Escribe el nuevo estado:\n${estados.join("\n")}`
            );

            if (!nuevoEstado) return;

            if (!estados.includes(nuevoEstado)) {
                aviso("Estado no válido.", false);
                return;
            }

            await solicitar(`/${id}/estado`, {
                method: "PATCH",
                body: JSON.stringify({ estado: nuevoEstado })
            });

            aviso("Estado actualizado correctamente.");
            await cargarPedidos();

        } catch (error) {
            aviso(error.message, false);
        }
    }

    // CANCELAR PEDIDO
    async function cancelar(id) {
        try {
            if (!confirm(`¿Seguro que deseas cancelar el pedido #${id}?`)) {
                return;
            }

            await solicitar(`/${id}/cancelar`, {
                method: "PATCH"
            });

            aviso("Pedido cancelado correctamente.");
            await cargarPedidos();
            await cargarDatos();

        } catch (error) {
            aviso(error.message, false);
        }
    }

    // HISTORIAL
    async function historial(id) {
        try {
            const datos = await solicitar(`/${id}/historial`);

            alert(JSON.stringify(datos, null, 2));

        } catch (error) {
            aviso(error.message, false);
        }
    }

    // INICIAR MÓDULO
    async function iniciar() {
        try {
            if (!localStorage.getItem("token")) {
                aviso("Debes iniciar sesión para consultar los pedidos.", false);
                return;
            }

            await cargarDatos();
            await cargarPedidos();

        } catch (error) {
            aviso(error.message, false);
        }
    }

    return {
    iniciar,
    crear,
    agregarProductoPedido,
    guardarNuevoPedido,
    ver,
    editar,
    eliminarProducto,
    cambiarEstado,
    cancelar,
    historial
};
})();

function mostrarFormulario() {
    Pedidos.crear();
}

document.addEventListener("DOMContentLoaded", Pedidos.iniciar);
