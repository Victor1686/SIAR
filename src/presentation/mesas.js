const API_MESAS = "http://localhost:3000/api/mesas";

let mesas = [];

async function peticion(url, opciones = {}) {
    const token = localStorage.getItem("token");

    if (!token) {
        window.location.href = "login.html";
        throw new Error("Sesión no iniciada.");
    }

    const respuesta = await fetch(url, {
        ...opciones,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...opciones.headers
        }
    });

    if (respuesta.status === 401 || respuesta.status === 403) {
        localStorage.removeItem("token");
        window.location.href = "login.html";
        throw new Error("Sesión no autorizada.");
    }

    const datos = await respuesta.json();

    if (!respuesta.ok) {
        throw new Error(datos.error || "Ocurrió un error.");
    }

    return datos;
}

async function cargarMesas() {
    try {
        mesas = await peticion(API_MESAS);
        mostrarMesas();
        actualizarResumen();
    } catch (error) {
        mostrarMensaje(error.message);
    }
}

function cerrarSesion() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    window.location.href = "login.html";
}

function mostrarMesas() {
    const lista = document.getElementById("listaMesas");
    const busqueda = document.getElementById("busqueda").value.toLowerCase();
    const estado = document.getElementById("filtroEstado").value;

    const filtradas = mesas.filter(mesa =>
        String(mesa.numero).includes(busqueda) &&
        (!estado || mesa.estado === estado)
    );

    lista.innerHTML = "";

    if (filtradas.length === 0) {
        lista.textContent = "No se encontraron mesas.";
        return;
    }

    filtradas.forEach(mesa => {
        const tarjeta = document.createElement("article");
        tarjeta.className = "mesa";

        const titulo = document.createElement("h3");
        titulo.textContent = `Mesa ${mesa.numero}`;

        const capacidad = document.createElement("p");
        capacidad.textContent = `Capacidad: ${mesa.capacidad} personas`;

        const ubicacion = document.createElement("p");
        ubicacion.textContent = `Ubicación: ${mesa.ubicacion}`;

        const estadoTexto = document.createElement("p");
        estadoTexto.className = "estado";
        estadoTexto.textContent = `Estado: ${mesa.estado}`;

        const selector = document.createElement("select");

        ["Disponible", "Ocupada", "Reservada"].forEach(estado => {
            const opcion = document.createElement("option");
            opcion.value = estado;
            opcion.textContent = estado;
            selector.appendChild(opcion);
        });

        selector.value = mesa.estado;
        selector.addEventListener("change", () =>
            cambiarEstado(mesa.id_mesa, selector.value)
        );

        const boton = document.createElement("button");
        boton.textContent = "Editar";
        boton.addEventListener("click", () => editarMesa(mesa.id_mesa));

        tarjeta.append(titulo, capacidad, ubicacion, estadoTexto, selector, boton);
        lista.appendChild(tarjeta);
    });
}

function actualizarResumen() {
    document.getElementById("total").textContent = mesas.length;

    document.getElementById("disponibles").textContent =
        mesas.filter(m => m.estado === "Disponible").length;

    document.getElementById("ocupadas").textContent =
        mesas.filter(m => m.estado === "Ocupada").length;

    document.getElementById("reservadas").textContent =
        mesas.filter(m => m.estado === "Reservada").length;
}

function abrirFormulario() {
    document.getElementById("formMesa").reset();
    document.getElementById("idMesa").value = "";
    document.getElementById("tituloFormulario").textContent = "Registrar mesa";
    document.getElementById("modal").style.display = "flex";
}

function cerrarFormulario() {
    document.getElementById("modal").style.display = "none";
}

function editarMesa(id) {
    const mesa = mesas.find(m => m.id_mesa === id);

    if (!mesa) return;

    document.getElementById("idMesa").value = mesa.id_mesa;
    document.getElementById("numero").value = mesa.numero;
    document.getElementById("capacidad").value = mesa.capacidad;
    document.getElementById("ubicacion").value = mesa.ubicacion;

    document.getElementById("tituloFormulario").textContent = "Editar mesa";
    document.getElementById("modal").style.display = "flex";
}

document.getElementById("formMesa").addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("idMesa").value;

    const datos = {
        numero: document.getElementById("numero").value,
        capacidad: document.getElementById("capacidad").value,
        ubicacion: document.getElementById("ubicacion").value
    };

    try {
        if (id) {
            await peticion(`${API_MESAS}/${id}`, {
                method: "PUT",
                body: JSON.stringify(datos)
            });

            mostrarMensaje("Mesa actualizada correctamente.");
        } else {
            await peticion(API_MESAS, {
                method: "POST",
                body: JSON.stringify(datos)
            });

            mostrarMensaje("Mesa registrada correctamente.");
        }

        cerrarFormulario();
        await cargarMesas();

    } catch (error) {
        mostrarMensaje(error.message);
    }
});

async function cambiarEstado(id, estado) {
    try {
        await peticion(`${API_MESAS}/${id}/estado`, {
            method: "PATCH",
            body: JSON.stringify({ estado })
        });

        mostrarMensaje("Estado actualizado correctamente.");
        await cargarMesas();

    } catch (error) {
        mostrarMensaje(error.message);
        await cargarMesas();
    }
}

function mostrarMensaje(texto) {
    document.getElementById("mensaje").textContent = texto;
}

document.getElementById("busqueda").addEventListener("input", mostrarMesas);
document.getElementById("filtroEstado").addEventListener("change", mostrarMesas);
document.getElementById("itemSalir").classList.remove("d-none");
cargarMesas();