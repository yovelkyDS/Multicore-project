# GameTECs

## Descripción General

**GameTECs** es un proyecto académico que integra procesamiento concurrente (multicore), web scraping y almacenamiento en la nube mediante **Firebase Realtime Database**, con el fin de recopilar, procesar y visualizar información sobre videojuegos.

El propósito central es demostrar cómo el uso de paralelismo en Python puede optimizar la recopilación de grandes volúmenes de datos provenientes de distintas fuentes web, mejorando la eficiencia y reduciendo los tiempos de respuesta en comparación con una ejecución secuencial tradicional.

## Objetivo del Proyecto

- Aplicar los principios del procesamiento concurrente para acelerar la obtención de datos en múltiples hilos. 
- Implementar un flujo de trabajo completo que integre extracción de información (web scraping), procesamiento y limpieza, y visualización web dinámica.

## Tecnologías Utilizadas

### Backend (Python)
- **requests:** Realiza las solicitudes HTTP a las páginas y APIs.
- **BeautifulSoup4:** Analiza y etrae datos estructurados delas páginas HTML.
- **concurrent.futures.ThreadPoolExecutor:** Implementa el procesamiento paralelo.
- **firebase_admin:** Conecta y envía datos al Realtime Database de Firebase.
- **howlongtobeatpy:** Obtiene información sobre la duración estimada de los videojuegos.
- **Steam API:** Recupera precios precios y detalles oficiales de cada título.

### Frontend (Interfaz de usuario)
- **HTML:** Define la estructura de las páginas, como los títulos, botones, imágenes y listas de juegos.
- **CSS:** Se encarga del diseño y la apariencia: colores, tipografías, distribución de los elementos y adaptación a distintos tamaños de pantalla.

- **JavaScript:** Permite que la página se conecte a la base de datos de Firebase y actualice los datos automáticamente sin necesidad de recargar.

## Estructura del Proyecto

- `/index.html`: Página principal con la lista de juegos.
- `/webScrapping.py`: Script pricipal de scraping y carga de datos.
- `/Lista de Juegos.txt`: Lista base de juegos a procesar. 

## Funcionamiento General
### 1. Entrada:
El sistema toma una lista de juegos desde **Lista de Juegos.txt**.

### 2. Extracción de datos (Scraping):
El script **webScrapping.py** ejecuta múltiples hilos concurrentes para:
- Consultar la API de Steam y obtener el precio actual de cada título.
- Consultar la API de *HowLongToBeat* para conocer la duración promedio.

### 3. Procesamiento y envío:
Los datos obtenidos se limpian, transforman y envían al **Firebase Realtime Database** mediante el SDK de **firebase_admin**.

### 4. Visualización:
La interfaz web *(index.html y details.html)* conecta con Firebase usando JavaScript y muestra la información actualizada en tiempo real, permitiendo explorar los juegos registrados.

## Ejecución del Proyecto

