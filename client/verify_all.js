import { exec } from "child_process";
import { io } from "socket.io-client";
import { promisify } from "util";

const execAsync = promisify(exec);

console.log("=== INICIANDO MASTER TEST DE INTEGRACIÓN (FASE 8) ===");

const resetServer = async () => {
  return new Promise((resolve, reject) => {
    console.log("\n🧹 Solicitando reinicio completo del servidor...");
    const socket = io("http://localhost:3000");
    
    socket.on("connect", () => {
      socket.emit("admin:reset_event");
      // Wait a moment for reset to execute and propagate
      setTimeout(() => {
        socket.disconnect();
        console.log("✅ Servidor reiniciado a cero.");
        resolve();
      }, 1500);
    });

    socket.on("connect_error", (err) => {
      socket.disconnect();
      reject(new Error("No se pudo conectar al servidor para reiniciar: " + err.message));
    });
  });
};

const runScript = async (name) => {
  console.log(`\n🚀 Ejecutando: ${name}...`);
  try {
    const { stdout, stderr } = await execAsync(`node ${name}`, { cwd: "./" });
    console.log(stdout);
    if (stderr) {
      console.warn("⚠️ Advertencia del test:\n", stderr);
    }
    console.log(`✅ Test '${name}' completado con éxito.`);
  } catch (error) {
    console.error(`❌ Error en el test '${name}':`);
    console.error(error.stdout || error.message);
    throw error;
  }
};

const main = async () => {
  try {
    // 1. Reset and run Trivia
    await resetServer();
    await runScript("verify_trivia.js");

    // 2. Reset and run Impostor
    await resetServer();
    await runScript("verify_impostor.js");

    // 3. Reset and run Misiones
    await resetServer();
    await runScript("verify_misiones.js");

    console.log("\n==============================================");
    console.log("🎉 ¡TODOS LOS TEST DE INTEGRACIÓN PASARON EXITOSAMENTE!");
    console.log("==============================================");
    process.exit(0);
  } catch (err) {
    console.error("\n==============================================");
    console.error("❌ EL MASTER TEST FALLÓ debido a un error.");
    console.error("==============================================");
    process.exit(1);
  }
};

main();
