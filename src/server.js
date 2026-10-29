
const express = require("express");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
database: process.env.DB_NAME || "siar_db"};

let conexion;

async function iniciarServidor() {
    try {
        conexion = await mysql.createConnection(dbConfig);
        console.log("Conexión a MySQL exitosa");

        app.get("/", (req, res) => {
            res.json({
                mensaje: "API del sistema SIAR funcionando"
            });
        });

        app.get("/api/usuarios", async (req, res) => {
            try {
                const [usuarios] = await conexion.execute(
                    "SELECT id_usuario, nombre, correo, usuario FROM USUARIO"
                );

                res.json(usuarios);
            } catch (error) {
                console.error(error.message);
                res.status(500).json({
                    error: "No se pudieron consultar los usuarios"
                });
            }
        });

        app.listen(PORT, () => {
            console.log(`Servidor SIAR activo en puerto ${PORT}`);
        });

    } catch (error) {
        console.error(
            "Error al iniciar SIAR:",
            error.message
        );
    }
}

iniciarServidor();
