import re
import time
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from howlongtobeatpy import HowLongToBeat
import firebase_admin
from firebase_admin import credentials, db

# CONFIGURACIÓN FIREBASE RTDB
DB_URL = "https://multicore-project-default-rtdb.firebaseio.com"  
cred = credentials.Certificate("credenciales.json")          
firebase_admin.initialize_app(cred, {"databaseURL": DB_URL})

# SESIÓN HTTP CON REINTENTOS OPTIMIZADOS
def make_session():
    s = requests.Session()
    s.headers.update({
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        )
    })
    retry = Retry(total=2, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://", HTTPAdapter(max_retries=retry))
    return s

SESSION = make_session()

# FUNCIONES AUXILIARES
def slug(text):
    """Convierte el nombre del juego en un ID limpio para Firebase."""
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    return re.sub(r"\s+", "-", text)

def dividir_en_chunks(lista, tamano):
    """Divide una lista en sublistas (lotes) del tamaño especificado."""
    for i in range(0, len(lista), tamano):
        yield lista[i:i + tamano]

# AMAZON
def scrape_amazon_precio(juego):
    """Obtiene el precio desde Amazon."""
    try:
        url = f"https://www.amazon.com/s?k={juego.replace(' ', '+')}"
        r = SESSION.get(url, timeout=6)
        soup = BeautifulSoup(r.text, "html.parser")

        precio_el = soup.select_one("span.a-price > span.a-offscreen")
        if precio_el:
            precio = float(re.sub(r"[^\d.]", "", precio_el.text))
            return {"precio": precio}
        return {"precio": None}
    except Exception:
        return {"precio": None}

# PLAYSTATION STORE
def scrape_playstation_precio(juego):
    """Obtiene el precio desde PlayStation Store."""
    try:
        url = f"https://store.playstation.com/en-us/search/{juego.replace(' ', '%20')}"
        r = SESSION.get(url, timeout=8)
        match = re.search(r"\$\s*\d+(?:\.\d{2})", r.text)
        precio = float(match.group().replace("$", "").strip()) if match else None
        return {"precio": precio}
    except Exception:
        return {"precio": None}

# HOW LONG TO BEAT
def scrape_hltb_tiempo(juego):
    """Obtiene el tiempo promedio del juego."""
    try:
        results = HowLongToBeat().search(juego)
        if not results:
            return "Desconocido"
        best = max(results, key=lambda x: x.similarity)
        return best.main_story or best.main_extra or best.completionist or "Desconocido"
    except Exception:
        return "Desconocido"

# PROCESAR JUEGO (CREAR O ACTUALIZAR)
def procesar_juego(nombre_juego):
    try:
        ref = db.reference(f"juegos/{slug(nombre_juego)}")
        existente = ref.get()

        # === Paralelismo por juego ===
        with ThreadPoolExecutor(max_workers=2) as ex:
            tareas = {
                ex.submit(scrape_amazon_precio, nombre_juego): "amazon",
                ex.submit(scrape_playstation_precio, nombre_juego): "playstation",
                ex.submit(scrape_hltb_tiempo, nombre_juego): "hltb"
            }
            resultados = {}
            for fut in as_completed(tareas):
                sitio = tareas[fut]
                try:
                    resultados[sitio] = fut.result()
                except Exception:
                    resultados[sitio] = None

        # === Estructura base ===
        data = {
            "nombreJuego": nombre_juego,
            "precios": {
                "amazon": resultados["amazon"],
                "playstation": resultados["playstation"]
            },
            "howLongToBeat": resultados["hltb"]
        }

        # === Crear o actualizar ===
        if existente is None:
            ref.set(data)
            print(f"-> {nombre_juego} agregado (sin 'en_oferta').")
        else:
            en_oferta = False
            for sitio in ["amazon", "playstation"]:
                precio = resultados[sitio]["precio"]
                prev_precio = existente.get("precios", {}).get(sitio, {}).get("precio")
                if prev_precio and precio and precio < prev_precio:
                    en_oferta = True
                    break

            data["en_oferta"] = en_oferta
            ref.update(data)
            print(f"- {nombre_juego} actualizado correctamente.")

    except Exception as e:
        print(f"💥 Error procesando {nombre_juego}: {e}")

# PROCESAMIENTO GLOBAL (POR LOTES)
def main():
    with open("Lista de Juegos.txt", "r", encoding="utf-8") as f:
        juegos = [ln.strip() for ln in f if ln.strip()]

    print(f"Procesando {len(juegos)} juegos...\n")
    inicio_total = time.time()

    # tamaño de cada lote
    chunk_size = 40
    lotes = list(dividir_en_chunks(juegos, chunk_size))
    print(f"Dividido en {len(lotes)} lotes de {chunk_size} juegos cada uno.\n")

    for idx, lote in enumerate(lotes, 1):
        print(f"🔹 Procesando lote {idx}/{len(lotes)} ({len(lote)} juegos)...")
        inicio_lote = time.time()

        # Cada lote se procesa en paralelo
        with ThreadPoolExecutor(max_workers=5) as ex:
            futures = [ex.submit(procesar_juego, j) for j in lote]
            for fut in as_completed(futures):
                fut.result()

        print(f"✅ Lote {idx} completado en {time.time() - inicio_lote:.2f}s\n")
        # Pequeña pausa opcional para evitar bloqueo de IP
        time.sleep(1.0)

    print(f"\nTiempo total: {time.time() - inicio_total:.2f}s")

if __name__ == "__main__":
    main()
