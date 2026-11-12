/* ==========================================================
   POKÉDEX MÓVIL
   Secciones: 1 Configuración · 2 Utilidades · 3 Caché
   4 API · 5 Estado · 6 Lista · 7 Favoritos · 8 Ficha
   9 Equipo · 10 Comparador · 11 Juego · 12 Navegación
   13 Tema · 14 Inicio
   ========================================================== */


/* ================= 1. CONFIGURACIÓN ================= */
const API = "https://pokeapi.co/api/v2/";
const POR_PAGINA = 20;   // cuántos Pokémon se cargan cada vez
const LIMITE = 1025;     // total de Pokémon que se muestran

// Rango de números de cada generación
const GENS = [
  [1, 151], [152, 251], [252, 386], [387, 493], [494, 649],
  [650, 721], [722, 809], [810, 905], [906, 1025]
];

// Color de cada tipo
const colores = {
  fire: "#f08030", water: "#6890f0", grass: "#78c850", electric: "#f8c800",
  psychic: "#f85888", ice: "#58c8c8", dragon: "#7038f8", dark: "#705848",
  fairy: "#ee99ac", normal: "#a8a878", fighting: "#c03028", flying: "#8c7fe0",
  poison: "#a040a0", ground: "#c8a040", rock: "#b8a038", bug: "#a8b820",
  ghost: "#705898", steel: "#808090"
};

// Nombre de cada tipo en español
const tiposES = {
  fire: "fuego", water: "agua", grass: "planta", electric: "eléctrico",
  psychic: "psíquico", ice: "hielo", dragon: "dragón", dark: "siniestro",
  fairy: "hada", normal: "normal", fighting: "lucha", flying: "volador",
  poison: "veneno", ground: "tierra", rock: "roca", bug: "bicho",
  ghost: "fantasma", steel: "acero"
};

// Nombre de cada estadística en español
const statsES = {
  "hp": "PS",
  "attack": "Ataque",
  "defense": "Defensa",
  "special-attack": "At. esp.",
  "special-defense": "Def. esp.",
  "speed": "Velocidad"
};


/* ================= 2. UTILIDADES ================= */

// Atajo para buscar un elemento por su id
const $ = id => document.getElementById(id);

// Vibración corta (solo funciona en celulares compatibles)
function vibrar(ms){
  if(navigator.vibrate) navigator.vibrate(ms);
}

// Cambia "special-attack" por "special attack"
function limpio(texto){
  return texto.replace(/-/g, " ");
}

// Saca el número final de una URL de la API (…/pokemon/25/ → 25)
function idDeUrl(url){
  return Number(url.split("/").filter(Boolean).pop());
}

// Mensaje flotante que desaparece solo
function toast(texto){
  const caja = $("toast");
  caja.textContent = texto;
  caja.classList.add("ver");
  setTimeout(() => caja.classList.remove("ver"), 2000);
}

// Convierte una lista de tipos en etiquetas de color
function etiquetasTipos(tipos){
  return tipos.map(t =>
    `<span class="tipo" style="background:${colores[t] || "#777"}">${tiposES[t] || t}</span>`
  ).join("");
}


/* ================= 3. CACHÉ (localStorage) ================= */

function leer(clave, valorPorDefecto){
  try{
    const valor = localStorage.getItem(clave);
    return valor === null ? valorPorDefecto : JSON.parse(valor);
  }catch(e){
    return valorPorDefecto;
  }
}

function guardar(clave, valor){
  try{
    localStorage.setItem(clave, JSON.stringify(valor));
  }catch(e){
    // Si el almacenamiento está lleno o bloqueado, la app sigue funcionando
  }
}

// Peticiones que están en camino, para no repetirlas
const enVuelo = new Map();

// 1) Busca en el caché  2) Si no está, pide a la API  3) Guarda el resultado
function conCache(clave, url, transformar){
  const guardado = leer(clave, null);
  if(guardado !== null) return Promise.resolve(guardado);
  if(enVuelo.has(clave)) return enVuelo.get(clave);

  const promesa = fetch(url)
    .then(respuesta => {
      if(!respuesta.ok) throw new Error("Error " + respuesta.status);
      return respuesta.json();
    })
    .then(datos => {
      const resultado = transformar(datos);
      guardar(clave, resultado);
      enVuelo.delete(clave);
      return resultado;
    })
    .catch(error => {
      enVuelo.delete(clave);
      throw error;
    });

  enVuelo.set(clave, promesa);
  return promesa;
}


/* ================= 4. API ================= */

// Lista de todos los Pokémon: [{id, name}]
function obtenerListaTodos(){
  return conCache("lista", API + "pokemon?limit=" + LIMITE, datos =>
    datos.results.map(x => ({ id: idDeUrl(x.url), name: x.name }))
  );
}

// Pokémon de un tipo y sus relaciones de daño
function obtenerTipo(nombre){
  return conCache("tipo:" + nombre, API + "type/" + nombre, datos => ({
    lista: datos.pokemon
      .map(x => ({ id: idDeUrl(x.pokemon.url), name: x.pokemon.name }))
      .filter(x => x.id <= LIMITE)
      .sort((a, b) => a.id - b.id),
    rel: datos.damage_relations
  }));
}

// Datos completos de un Pokémon (solo se guarda lo necesario)
function obtenerPokemon(id){
  return conCache("pk:" + id, API + "pokemon/" + id, datos => {
    const arte = datos.sprites.other["official-artwork"];
    return {
      id: datos.id,
      name: datos.name,
      types: datos.types.map(t => t.type.name),
      height: datos.height,
      weight: datos.weight,
      stats: datos.stats.map(s => ({ n: s.stat.name, v: s.base_stat })),
      sprite: datos.sprites.front_default || arte.front_default,
      art: arte.front_default,
      shiny: arte.front_shiny,
      cry: datos.cries ? datos.cries.latest : null,
      hab: datos.abilities.map(x => x.ability.name),
      mov: datos.moves.slice(0, 6).map(x => x.move.name)
    };
  });
}

// Descripción (en español si existe) y enlace de su cadena de evolución
function obtenerEspecie(id){
  return conCache("sp:" + id, API + "pokemon-species/" + id, datos => {
    const textos = datos.flavor_text_entries;
    const texto = textos.find(x => x.language.name === "es") ||
                  textos.find(x => x.language.name === "en");
    return {
      descripcion: texto ? texto.flavor_text.replace(/[\n\f]/g, " ") : "Sin descripción.",
      cadena: datos.evolution_chain.url
    };
  });
}

// Convierte el árbol de evolución en etapas: [[id1], [id2, id3], ...]
function armarEtapas(nodo, nivel = 0, acumulado = []){
  if(!acumulado[nivel]) acumulado[nivel] = [];
  acumulado[nivel].push(idDeUrl(nodo.species.url));
  nodo.evolves_to.forEach(hijo => armarEtapas(hijo, nivel + 1, acumulado));
  return acumulado;
}

function obtenerEvolucion(url){
  return conCache("ev:" + idDeUrl(url), url, datos => armarEtapas(datos.chain));
}


/* ================= 5. ESTADO ================= */
let todos = [];          // lista completa
let actual = [];         // lista que se está mostrando
let cantidad = 0;        // cuántos se han mostrado
let version = 0;         // sirve para descartar respuestas viejas
let filtro = "todos";    // tipo elegido
let gen = 0;             // generación elegida (0 = todas)
let orden = "num";       // "num" o "nom"
let vista = "inicio";    // inicio, favoritos, equipo o juego
let abierto = null;      // Pokémon de la ficha abierta
let shiny = false;       // si la ficha muestra la versión shiny
let favoritos = leer("favoritos", []);
let equipo = leer("equipo", []);
let comparar = [];       // ids elegidos para comparar (máximo 2)

const lista = $("lista");
const mensaje = $("mensaje");
const btnMas = $("btnMas");
const detalle = $("detalle");
const comparador = $("comparador");

// Muestra un error con botón para reintentar
function errorRed(reintentar){
  mensaje.innerHTML =
    (navigator.onLine ? "No se pudo cargar. " : "Sin conexión. ") +
    '<button class="reint">Reintentar</button>';
  mensaje.querySelector(".reint").addEventListener("click", reintentar);
}


/* ================= 6. LISTA (filtros, orden, paginación) ================= */

// Arma la lista según vista, tipo, generación, búsqueda y orden
async function recalcular(){
  const miVersion = ++version;
  mensaje.textContent = "";
  let base;

  try{
    if(vista === "favoritos"){
      base = favoritos.map(id => todos.find(x => x.id === id) || { id, name: "" });
    }else if(filtro === "todos"){
      base = todos;
    }else{
      base = (await obtenerTipo(filtro)).lista;
    }
  }catch(e){
    errorRed(recalcular);
    return;
  }
  if(miVersion !== version) return;

  if(vista === "inicio"){
    // Filtro por generación
    if(gen){
      const [desde, hasta] = GENS[gen - 1];
      base = base.filter(x => x.id >= desde && x.id <= hasta);
    }
    // Búsqueda por nombre parcial o por número
    const q = $("busqueda").value.trim().toLowerCase();
    if(q){
      base = base.filter(x => /^\d+$/.test(q) ? x.id === Number(q) : x.name.includes(q));
    }
    // Orden
    base = [...base].sort(orden === "nom"
      ? (a, b) => a.name.localeCompare(b.name)
      : (a, b) => a.id - b.id);
  }

  actual = base;
  lista.innerHTML = "";
  cantidad = 0;

  if(actual.length === 0){
    mensaje.textContent = vista === "favoritos"
      ? "Aún no tienes favoritos. Toca el 🤍 de un Pokémon."
      : "No se encontraron Pokémon.";
    btnMas.classList.add("oculto");
    return;
  }
  mostrarMas();
}

// Carga el siguiente grupo de 20 con "esqueletos" mientras llegan los datos
async function mostrarMas(){
  const miVersion = version;
  const grupo = actual.slice(cantidad, cantidad + POR_PAGINA);
  btnMas.classList.add("oculto");

  const esqueletos = grupo.map(() => {
    const e = document.createElement("div");
    e.className = "tarjeta esqueleto";
    lista.appendChild(e);
    return e;
  });

  try{
    const pokes = await Promise.all(grupo.map(x => obtenerPokemon(x.id)));
    if(miVersion !== version) return; // llegó una búsqueda más nueva

    esqueletos.forEach(e => e.remove());
    pokes.forEach((p, i) => {
      const tarjeta = crearTarjeta(p);
      tarjeta.style.animationDelay = (i * 30) + "ms";
      lista.appendChild(tarjeta);
    });

    cantidad += grupo.length;
    btnMas.classList.toggle("oculto", cantidad >= actual.length);
    mensaje.textContent = `Mostrando ${cantidad} de ${actual.length}`;
  }catch(e){
    if(miVersion === version){
      esqueletos.forEach(x => x.remove());
      errorRed(mostrarMas);
    }
  }
}

function crearTarjeta(p){
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta";
  tarjeta.tabIndex = 0;
  tarjeta.style.setProperty("--c", colores[p.types[0]] || "#777");
  tarjeta.innerHTML = `
    <button class="icono fav" data-id="${p.id}" aria-label="Favorito">${iconoFav(p.id)}</button>
    <img src="${p.sprite}" alt="${p.name}" loading="lazy">
    <div class="num">#${String(p.id).padStart(3, "0")}</div>
    <div class="nom">${p.name}</div>`;

  tarjeta.querySelector(".fav").addEventListener("click", e => {
    e.stopPropagation();
    alternarFavorito(p.id);
  });
  tarjeta.addEventListener("click", () => abrirDetalle(p));
  tarjeta.addEventListener("keydown", e => {
    if(e.key === "Enter") abrirDetalle(p);
  });
  return tarjeta;
}

btnMas.addEventListener("click", mostrarMas);


/* ================= 7. FAVORITOS ================= */
function iconoFav(id){
  return favoritos.includes(id) ? "❤️" : "🤍";
}

function alternarFavorito(id){
  if(favoritos.includes(id)){
    favoritos = favoritos.filter(x => x !== id);
  }else{
    favoritos.push(id);
  }
  guardar("favoritos", favoritos);
  vibrar(20);

  // Actualiza todos los corazones visibles de ese Pokémon
  document.querySelectorAll(`.fav[data-id="${id}"]`).forEach(b => {
    b.textContent = iconoFav(id);
  });
  if(abierto && abierto.id === id) $("dFav").textContent = iconoFav(id);
  if(vista === "favoritos") recalcular();
}


/* ================= 8. FICHA DE DETALLE ================= */

// Calcula el multiplicador de daño que recibe contra cada tipo
async function calcularDebilidades(tipos){
  const mult = {};
  const aplicar = (nombre, factor) => {
    mult[nombre] = (nombre in mult ? mult[nombre] : 1) * factor;
  };

  const datos = await Promise.all(tipos.map(obtenerTipo));
  datos.forEach(d => {
    d.rel.double_damage_from.forEach(x => aplicar(x.name, 2));
    d.rel.half_damage_from.forEach(x => aplicar(x.name, 0.5));
    d.rel.no_damage_from.forEach(x => aplicar(x.name, 0));
  });
  return mult;
}

function dibujarDebilidades(mult){
  const grupo = (condicion, titulo) => {
    const claves = Object.keys(mult).filter(condicion);
    if(claves.length === 0) return "";
    const etiquetas = claves.map(k =>
      `<span class="tipo" style="background:${colores[k] || "#777"}">${tiposES[k] || k}${mult[k] === 4 ? " ×4" : ""}</span>`
    ).join("");
    return `<p class="fila-deb"><b>${titulo}</b>${etiquetas}</p>`;
  };
  return grupo(k => mult[k] > 1, "Débil a") +
         grupo(k => mult[k] > 0 && mult[k] < 1, "Resiste") +
         grupo(k => mult[k] === 0, "Inmune a");
}

async function abrirDetalle(p){
  abierto = p;
  shiny = false;
  const color = colores[p.types[0]] || "#777";

  // Datos que ya tenemos
  $("ficha").style.setProperty("--c", color);
  $("dImg").src = p.art || p.sprite;
  $("dNombre").textContent = `#${p.id} ${p.name}`;
  $("dFav").textContent = iconoFav(p.id);
  $("dShiny").classList.remove("activo");
  $("dEq").classList.toggle("activo", equipo.includes(p.id));
  $("dComp").classList.toggle("activo", comparar.includes(p.id));
  $("dTipos").innerHTML = etiquetasTipos(p.types);
  $("dMedidas").textContent = `Altura: ${p.height / 10} m · Peso: ${p.weight / 10} kg`;
  $("dHab").textContent = p.hab.map(limpio).join(", ");
  $("dMov").textContent = p.mov.map(limpio).join(", ");
  $("dStats").innerHTML = p.stats.map(s => `
    <div class="stat">
      <span>${statsES[s.n] || s.n}</span>
      <div class="barra"><i style="--w:${Math.min(s.v / 150 * 100, 100)}%;background:${color}"></i></div>
      <b>${s.v}</b>
    </div>`).join("");

  // Datos que se cargan después
  $("dDesc").textContent = "Cargando…";
  $("dEvo").innerHTML = "";
  $("dDeb").innerHTML = "";
  detalle.classList.remove("oculto");
  $("ficha").scrollTop = 0;

  try{
    const [especie, mult] = await Promise.all([
      obtenerEspecie(p.id),
      calcularDebilidades(p.types)
    ]);
    if(abierto !== p) return; // el usuario ya abrió otro
    $("dDesc").textContent = especie.descripcion;
    $("dDeb").innerHTML = dibujarDebilidades(mult);

    const etapas = await obtenerEvolucion(especie.cadena);
    if(abierto !== p) return;
    dibujarEvolucion(etapas, p);
  }catch(e){
    if(abierto === p){
      $("dDesc").textContent = "Información no disponible sin conexión.";
    }
  }
}

async function dibujarEvolucion(etapas, p){
  const contenedor = $("dEvo");
  if(etapas.length < 2){
    contenedor.innerHTML = '<p class="medidas">Este Pokémon no evoluciona.</p>';
    return;
  }

  const grupos = await Promise.all(
    etapas.map(ids => Promise.all(ids.map(obtenerPokemon)))
  );
  if(abierto !== p) return;

  contenedor.innerHTML = "";
  grupos.forEach((grupo, i) => {
    if(i > 0) contenedor.insertAdjacentHTML("beforeend", '<span class="flecha">➜</span>');

    const columna = document.createElement("div");
    columna.className = "evo-grupo";
    grupo.forEach(q => {
      const boton = document.createElement("button");
      boton.className = "evo";
      boton.innerHTML = `<img src="${q.sprite}" alt="${q.name}"><span>${q.name}</span>`;
      boton.addEventListener("click", () => abrirDetalle(q)); // tocar una etapa abre ese Pokémon
      columna.appendChild(boton);
    });
    contenedor.appendChild(columna);
  });
}

function cerrarDetalle(){
  detalle.classList.add("oculto");
  abierto = null;
}

$("cerrar").addEventListener("click", cerrarDetalle);
detalle.addEventListener("click", e => {
  if(e.target === detalle) cerrarDetalle();
});

$("dFav").addEventListener("click", () => {
  if(abierto) alternarFavorito(abierto.id);
});

// Grito del Pokémon
$("dSonido").addEventListener("click", () => {
  if(abierto && abierto.cry){
    new Audio(abierto.cry).play().catch(() => {});
  }
});

// Alterna entre versión normal y shiny
$("dShiny").addEventListener("click", () => {
  if(!abierto) return;
  shiny = !shiny;
  vibrar(15);
  $("dShiny").classList.toggle("activo", shiny);
  $("dImg").src = (shiny && abierto.shiny) || abierto.art || abierto.sprite;
});

// Agrega o quita del equipo (máximo 6)
$("dEq").addEventListener("click", () => {
  if(!abierto) return;
  const id = abierto.id;

  if(equipo.includes(id)){
    equipo = equipo.filter(x => x !== id);
  }else if(equipo.length >= 6){
    toast("Tu equipo ya tiene 6 Pokémon");
    return;
  }else{
    equipo.push(id);
  }

  guardar("equipo", equipo);
  vibrar(20);
  $("dEq").classList.toggle("activo", equipo.includes(id));
  toast(equipo.includes(id) ? "Agregado al equipo" : "Quitado del equipo");
});

// Deslizar hacia abajo para cerrar la ficha
let inicioY = 0;
$("ficha").addEventListener("touchstart", e => {
  inicioY = e.touches[0].clientY;
}, { passive: true });
$("ficha").addEventListener("touchend", e => {
  const bajo = e.changedTouches[0].clientY - inicioY;
  if($("ficha").scrollTop === 0 && bajo > 100) cerrarDetalle();
}, { passive: true });

// Tecla Esc cierra las ventanas
document.addEventListener("keydown", e => {
  if(e.key === "Escape"){
    cerrarDetalle();
    comparador.classList.add("oculto");
  }
});


/* ================= 9. EQUIPO ================= */
async function pintarEquipo(){
  const contenedor = $("slots");
  contenedor.innerHTML = "";

  try{
    const pokes = await Promise.all(equipo.map(obtenerPokemon));

    // Siempre se dibujan 6 espacios
    for(let i = 0; i < 6; i++){
      if(pokes[i]){
        contenedor.appendChild(crearTarjeta(pokes[i]));
      }else{
        contenedor.insertAdjacentHTML("beforeend", '<div class="vacio">＋ Vacío</div>');
      }
    }

    // Tipos que cubre el equipo
    const tipos = [...new Set(pokes.flatMap(p => p.types))];
    $("tiposEquipo").innerHTML = tipos.length
      ? "Tipos de tu equipo:<br>" + etiquetasTipos(tipos)
      : "";
  }catch(e){
    errorRed(pintarEquipo);
  }
}


/* ================= 10. COMPARADOR ================= */
function alternarComparar(id){
  if(comparar.includes(id)){
    comparar = comparar.filter(x => x !== id);
  }else{
    comparar.push(id);
    if(comparar.length > 2) comparar.shift(); // solo se comparan 2
  }
  vibrar(15);
  actualizarBarraComparar();
}

async function actualizarBarraComparar(){
  $("barraComparar").classList.toggle("oculto", comparar.length === 0);
  if(abierto) $("dComp").classList.toggle("activo", comparar.includes(abierto.id));
  $("btnVerComp").disabled = comparar.length < 2;
  if(comparar.length === 0) return;

  try{
    const pokes = await Promise.all(comparar.map(obtenerPokemon));
    const nombres = pokes.map(p => p.name);
    $("textoComp").textContent = nombres.length < 2
      ? `Elige otro para comparar con ${nombres[0]}`
      : nombres.join(" vs ");
  }catch(e){
    $("textoComp").textContent = "Sin conexión";
  }
}

async function verComparacion(){
  try{
    const [a, b] = await Promise.all(comparar.map(obtenerPokemon));
    const colorA = colores[a.types[0]] || "#777";
    const colorB = colores[b.types[0]] || "#777";
    const total = p => p.stats.reduce((suma, s) => suma + s.v, 0);

    // Imagen y nombre de cada Pokémon
    const cabecera = (p, color) => `
      <div class="cab" style="border-color:${color}">
        <img src="${p.art || p.sprite}" alt="${p.name}">
        <div>${p.name}</div>
      </div>`;

    // Una barra con su valor; la mayor lleva ★
    const linea = (mio, otro, color, max) => `
      <div class="cmp-fila">
        <div class="barra"><i style="--w:${Math.min(mio / max * 100, 100)}%;background:${color}"></i></div>
        <b class="${mio > otro ? "gana" : ""}">${mio}${mio > otro ? " ★" : ""}</b>
      </div>`;

    const fila = (etiqueta, va, vb, max) => `
      <div class="cmp-stat">
        <div class="etq">${etiqueta}</div>
        ${linea(va, vb, colorA, max)}
        ${linea(vb, va, colorB, max)}
      </div>`;

    $("cContenido").innerHTML =
      `<div class="duo">${cabecera(a, colorA)}${cabecera(b, colorB)}</div>` +
      a.stats.map((s, i) => fila(statsES[s.n] || s.n, s.v, b.stats[i].v, 150)).join("") +
      fila("Total", total(a), total(b), 600);

    comparador.classList.remove("oculto");
  }catch(e){
    toast("No se pudo cargar la comparación");
  }
}

$("dComp").addEventListener("click", () => {
  if(abierto) alternarComparar(abierto.id);
});
$("btnVerComp").addEventListener("click", verComparacion);
$("btnLimpiarComp").addEventListener("click", () => {
  comparar = [];
  actualizarBarraComparar();
});
$("cerrarComp").addEventListener("click", () => comparador.classList.add("oculto"));
comparador.addEventListener("click", e => {
  if(e.target === comparador) comparador.classList.add("oculto");
});


/* ================= 11. JUEGO: ¿QUIÉN ES ESE POKÉMON? ================= */
let racha = 0;
let mejor = leer("mejor", 0);
let correcto = null;

function textoPuntos(){
  $("puntos").textContent = `Racha: ${racha} · Mejor: ${mejor}`;
}

async function nuevaRonda(){
  $("btnSig").classList.add("oculto");
  $("jImg").className = "silueta"; // silueta negra
  $("opciones").innerHTML = "";
  textoPuntos();

  try{
    // Pokémon al azar
    const id = 1 + Math.floor(Math.random() * LIMITE);
    const p = await obtenerPokemon(id);
    correcto = p;
    $("jImg").src = p.art || p.sprite;

    // 3 nombres incorrectos + el correcto
    const nombres = [p.name];
    while(nombres.length < 4){
      const n = todos[Math.floor(Math.random() * todos.length)].name;
      if(!nombres.includes(n)) nombres.push(n);
    }
    nombres.sort(() => Math.random() - 0.5);

    nombres.forEach(n => {
      const boton = document.createElement("button");
      boton.className = "op";
      boton.textContent = n;
      boton.addEventListener("click", () => responder(boton, n));
      $("opciones").appendChild(boton);
    });
  }catch(e){
    $("puntos").innerHTML = 'Sin conexión. <button class="reint">Reintentar</button>';
    $("puntos").querySelector(".reint").addEventListener("click", nuevaRonda);
  }
}

function responder(boton, nombre){
  // Bloquea los botones y marca el correcto en verde
  document.querySelectorAll(".op").forEach(o => {
    o.disabled = true;
    if(o.textContent === correcto.name) o.classList.add("ok");
  });
  $("jImg").className = ""; // revela la imagen

  if(nombre === correcto.name){
    racha++;
    vibrar(30);
    if(racha > mejor){
      mejor = racha;
      guardar("mejor", mejor);
    }
  }else{
    boton.classList.add("mal");
    racha = 0;
    vibrar([60, 40, 60]);
  }
  textoPuntos();
  $("btnSig").classList.remove("oculto");
}

$("btnSig").addEventListener("click", nuevaRonda);


/* ================= 12. NAVEGACIÓN INFERIOR ================= */
function irA(destino){
  vista = destino;
  vibrar(10);

  document.querySelectorAll(".tabs button").forEach(b => {
    b.classList.toggle("activo", b.dataset.vista === destino);
  });

  const esLista = destino === "inicio" || destino === "favoritos";
  $("vLista").classList.toggle("oculto", !esLista);
  $("controles").classList.toggle("oculto", destino !== "inicio");
  $("vEquipo").classList.toggle("oculto", destino !== "equipo");
  $("vJuego").classList.toggle("oculto", destino !== "juego");

  $("titulo").textContent = {
    inicio: "Pokédex",
    favoritos: "Favoritos",
    equipo: "Mi equipo",
    juego: "Juego"
  }[destino];

  if(esLista) recalcular();
  if(destino === "equipo") pintarEquipo();
  if(destino === "juego" && $("opciones").children.length === 0) nuevaRonda();
}

document.querySelectorAll(".tabs button").forEach(b => {
  b.addEventListener("click", () => irA(b.dataset.vista));
});


/* ================= 13. TEMA CLARO / OSCURO ================= */
function aplicarTema(oscuro){
  document.body.classList.toggle("oscuro", oscuro);
  $("btnTema").textContent = oscuro ? "☀️" : "🌙";
  guardar("oscuro", oscuro);
}

$("btnTema").addEventListener("click", () => {
  aplicarTema(!document.body.classList.contains("oscuro"));
});


/* ================= 14. INICIO ================= */

// Pokémon del día: cambia cada día según la fecha
async function pintarPokemonDelDia(){
  try{
    const dias = Math.floor(Date.now() / 86400000);
    const p = await obtenerPokemon(dias % LIMITE + 1);
    $("dia").innerHTML =
      `<img src="${p.sprite}" alt=""><span>⭐ Pokémon del día<br><b>${p.name}</b></span>`;
    $("dia").addEventListener("click", () => abrirDetalle(p));
  }catch(e){
    $("dia").classList.add("oculto");
  }
}

// Crea los botones de tipo, los selectores y la búsqueda
function prepararControles(){
  const contenedor = $("filtros");
  const botones = [["todos", "Todos"]].concat(
    Object.keys(tiposES).map(t => [t, tiposES[t]])
  );

  botones.forEach(([clave, texto]) => {
    const boton = document.createElement("button");
    boton.className = "chip" + (clave === "todos" ? " activo" : "");
    boton.textContent = texto;
    if(colores[clave]) boton.style.setProperty("--c", colores[clave]);

    boton.addEventListener("click", () => {
      filtro = clave;
      document.querySelectorAll(".chip").forEach(c => c.classList.toggle("activo", c === boton));
      recalcular();
    });
    contenedor.appendChild(boton);
  });

  $("gen").innerHTML = '<option value="0">Todas las generaciones</option>' +
    GENS.map((_, i) => `<option value="${i + 1}">Generación ${i + 1}</option>`).join("");

  $("gen").addEventListener("change", e => {
    gen = Number(e.target.value);
    recalcular();
  });
  $("orden").addEventListener("change", e => {
    orden = e.target.value;
    recalcular();
  });

  // Búsqueda en vivo: espera 300 ms después de la última tecla
  let temporizador;
  $("busqueda").addEventListener("input", () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(recalcular, 300);
  });

  // Tema: usa el guardado o, si no hay, el del sistema
  aplicarTema(leer("oscuro", matchMedia("(prefers-color-scheme: dark)").matches));

  // Registro del service worker (si existe sw.js); si falla, no pasa nada
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

async function iniciar(){
  try{
    todos = await obtenerListaTodos();
  }catch(e){
    $("splash").classList.add("fuera");
    errorRed(iniciar);
    return;
  }
  $("splash").classList.add("fuera");
  pintarPokemonDelDia();
  recalcular();
}

prepararControles();
iniciar();