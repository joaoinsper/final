document.getElementById('capa-button').addEventListener('click', () => {
    const capa = document.getElementById('capa');
    const mapContainer = document.getElementById('map-container');
    capa.classList.add('hidden');
    mapContainer.style.visibility = 'visible';
});

document.addEventListener("keydown", function (event) {
    const swiperEl = document.querySelector("swiper-container");
    if (!swiperEl) return;

    const swiper = swiperEl.swiper;

    if (event.key === "ArrowRight") {
        // Muda para o próximo slide
        swiper.slideNext();
    } else if (event.key === "ArrowLeft") {
        // Muda para o slide anterior
        swiper.slidePrev();
    }
});


let municipioBuscado = null; // Armazenando o município buscado
let tela = "brasil"; // Tela inicial
let municipiosne = ""; // Variável vazia que será recheada
let map; // Declaração da variável do mapa
let municipiosLayer, estadosLayerBrasil, estadosLayerNordeste, estadosLayerComparecimento, estadosLayerPorcentagem; // Declarações para as camadas
let form = document.querySelector('form');
let legendaAplicacao = null;
let legendaComparecimento = null;
let estadosGeoJSON, municipiosGeoJSON;

// Cria mapa
function initMap() {
    map = L.map("map", {
        zoomSnap: 0.1,
        center: [-15.7801, -52.9292], // Centro inicial
        zoom: 4.55, // Zoom inicial
    });
}

// Chama a função para inicializar o mapa
initMap();

// Função para buscar a cidade na base do nominatim
async function busca(cidade) {
    let resposta = await fetch(
        "https://nominatim.openstreetmap.org/search?q=" +
        cidade +
        "&format=jsonv2" +
        "&limit=1" +
        "&countrycodes=br" +
        municipiosne
    );
    let dados = await resposta.json();

    if (dados.length === 0) {
        alert("Município não encontrado");
    } else {
        let local = dados[0];
        mostra(local.lat, local.lon);
    }
}

// Função para mostrar o município no mapa
function mostra(lat, lon) {
    let centro = L.latLng(lat, lon);
    map.setView(centro, 8); // Zoom no município

    // Restaurar o estilo do município anteriormente buscado, se existir
    if (municipioBuscado) {
        municipiosLayer.resetStyle(municipioBuscado);
    }

    // Encontrar e destacar o município buscado no form
    municipiosLayer.eachLayer(layer => {
        if (layer.feature.properties.NM_MUN.toLowerCase() === input.value.toLowerCase()) {
            municipioBuscado = layer; // Armazena o layer do município buscado
            layer.setStyle({
                weight: 4, // Aumenta a espessura da borda
                color: '#FFD700', // Altera a cor da borda
                fillOpacity: 1 // Altera a opacidade do preenchimento
            });
        }
    });
}

// Estilizando municípios com as cores e bordas
function colorirMunicipios(feature) {
    return {
        fillColor: feature.properties.aplicou_prova === 'Sim' ? '#00682a' : '#cfcfcf', // Verde para "Sim", cinza para "Não"
        weight: 1,
        opacity: 1,
        color: "#4f4f4f",
        fillOpacity: 1,
    };
}

// Colocar tooltips nos municípios
function tooltipMunicipios(feature, layer) {
    if (feature.properties && feature.properties.NM_MUN) {
        layer.bindTooltip(feature.properties.NM_MUN, {
            permanent: false,
            direction: "top"
        });
    }

    layer.on({
        mouseover: function (e) {
            let layer = e.target;
            // If criado para manter o município buscado em destaque
            if (layer !== municipioBuscado) {
                layer.setStyle({
                    weight: 1,
                    color: 'black',
                    fillOpacity: 0.6
                });
            }
        },
        mouseout: function (e) {
            let layer = e.target;
            // If criado para manter o municipio buscado em destaque
            if (layer !== municipioBuscado) {
                municipiosLayer.resetStyle(layer);
            }
        }
    });
}

// Colocar tooltips no mapa de porcentagem
function tooltipPorcentagem(feature, layer) {
    const nomeEstado = feature.properties.SIGLA_UF || 'Sem nome';
    const mapaPorcentagem = feature.properties.Porcentagem;

    // Tooltip fixo (apenas se não for NaN)
    if (!isNaN(mapaPorcentagem)) {
        layer.bindTooltip(nomeEstado, {
            permanent: true,
            direction: 'center',
            className: 'state-label',
        }).openTooltip(layer.getBounds().getCenter());
    }

    // Adiciona eventos apenas se a porcentagem for válida
    if (!isNaN(mapaPorcentagem)) {
        layer.on('mouseover', function (e) {
            const porcentagemTooltip = L.tooltip({
                permanent: false,
                direction: 'top',
                className: 'custom-tooltip',
            })
                .setContent(`${mapaPorcentagem}% dos municípios aplicaram prova`)
                .setLatLng(e.latlng);

            map.addLayer(porcentagemTooltip);
            layer._dynamicTooltip = porcentagemTooltip;
        });

        layer.on('mouseout', function () {
            if (layer._dynamicTooltip) {
                map.removeLayer(layer._dynamicTooltip);
                layer._dynamicTooltip = null;
            }
        });
    } else {
        // Opcional: Define um estilo neutro para regiões sem dados
        layer.setStyle({
            fillColor: '#cccccc', // Cor cinza para NaN
            color: 'black',       // Cor da borda
            weight: 1,
            fillOpacity: 0.5,
        });
    }
}

// Colocar tooltip no mapa de não comparecimento
function tooltipComparecimento(feature, layer) {
    const nomeEstado = feature.properties.SIGLA_UF || 'Sem nome';
    const naoComparecimento = feature.properties.nao_comparecimento || 'Sem dados';

    // Tooltip fixo
    layer.bindTooltip(nomeEstado, {
        permanent: true,
        direction: 'center',
        className: 'state-label',
    }).openTooltip(layer.getBounds().getCenter());

    // Tooltip dinâmico
    layer.on('mouseover', function (e) {
        const dynamicTooltip = L.tooltip({
            permanent: false,
            direction: 'top',
            className: 'custom-tooltip',
        })
            .setContent(`${naoComparecimento}% dos candidatos não compareceram`)
            .setLatLng(e.latlng);

        map.addLayer(dynamicTooltip);
        layer._dynamicTooltip = dynamicTooltip;
    });

    layer.on('mouseout', function () {
        if (layer._dynamicTooltip) {
            map.removeLayer(layer._dynamicTooltip);
            layer._dynamicTooltip = null;
        }
    });
}

// Escolher ter interatividade apenas para CE e PI
function interatividadeCePi(feature, layer) {
    if (feature.properties.SIGLA_UF === "CE" || feature.properties.SIGLA_UF === "PI") {
        layer.options.interactive = false;
    } else {
        layer.options.interactive = true;
    }
}

// Carregar swiper
let swiperEl = document.querySelector("swiper-container");
swiperEl.addEventListener("swiperslidechange", (event) => {
    const swiper = event.target.swiper;
    const index = swiper.activeIndex;
    const slide = swiper.slides[index];
    tela = slide.dataset.tela;
    atualizaMapa();
});

// Carregar GeoJSONs
Promise.all([
    fetch('brasil.geojson').then(response => response.json()),
    fetch("estados.geojson").then((response) => response.json()),
])
    .then(([municipiosData, estadosData]) => {
        municipiosGeoJSON = municipiosData;
        estadosGeoJSON = estadosData;

        /// Função para que as linhas dos municípios no destaque de CE e PI funcionem 
        estadosData.features.sort((a, b) => {
            // Verifica se a SIGLA_UF de 'a' é CE ou PI
            const aIsCEorPI = a.properties.SIGLA_UF === "CE" || a.properties.SIGLA_UF === "PI";
            // Verifica se a SIGLA_UF de 'b' é CE ou PI
            const bIsCEorPI = b.properties.SIGLA_UF === "CE" || b.properties.SIGLA_UF === "PI";

            // Se 'a' for CE ou PI e 'b' não for, 'a' deve vir depois
            if (aIsCEorPI && !bIsCEorPI) {
                return 1; // 'a' é maior, deve vir depois
            }
            // Se 'b' for CE ou PI e 'a' não for, 'b' deve vir depois
            if (!aIsCEorPI && bIsCEorPI) {
                return -1; // 'b' é maior, deve vir depois
            }
            // Se ambos forem CE ou PI ou ambos não forem, mantém a ordem original
            return 0;
        });

        municipiosLayer = L.geoJSON(municipiosData, {
            style: colorirMunicipios,
            onEachFeature: tooltipMunicipios
        });

        estadosLayerBrasil = L.geoJSON(estadosGeoJSON, {
            style: {
                color: "black",
                weight: 2,
                fillOpacity: 0,
            },
            interactive: false,
        });

        estadosLayerNordeste = L.geoJSON(estadosGeoJSON, {
            style: feature => {
                if (feature.properties.SIGLA_UF === "CE" || feature.properties.SIGLA_UF === "PI") {
                    return {
                        color: 'black',
                        weight: 2,
                        fillOpacity: 0,
                    };
                } else {
                    return {
                        color: 'gray',
                        weight: 1,
                        fillOpacity: 1,
                    };
                }
            },
            onEachFeature: interatividadeCePi
        });

        estadosLayerComparecimento = L.geoJSON(estadosGeoJSON, {
            style: feature => {
                const naoComparecimento = feature.properties.nao_comparecimento || 0;
                const colorScale = d3.scaleSequential()
                    .domain([28, 49])
                    .interpolator(d3.interpolateReds);
                return {
                    fillColor: colorScale(naoComparecimento),
                    color: 'black',
                    weight: 2,
                    fillOpacity: 0.8,
                };
            },
            onEachFeature: tooltipComparecimento
        });

        estadosLayerPorcentagem = L.geoJSON(estadosGeoJSON, {
            style: feature => {
                const indPorcentagem = feature.properties.Porcentagem || 0;
                const colorirEstados = d3.scaleSequential()
                    .domain([15, 94])
                    .interpolator(d3.interpolateGreens);
                return {
                    fillColor: colorirEstados(indPorcentagem),
                    color: 'black', //borda
                    weight: 2,
                    fillOpacity: 0.8,
                };
            },
            onEachFeature: tooltipPorcentagem
        });

        // Inicializa a primeira tela
        atualizaMapa();
    });

// Função para alternar telas
function atualizaMapa() {
    const mapContainer = document.getElementById("map");
    const joaoFoto = document.getElementById("joao");

    // Redefine o estilo do município buscado
    if (municipioBuscado) {
        municipiosLayer.resetStyle(municipioBuscado);
        municipioBuscado = null; // Limpa a referência do município buscado
    }

    // Remove legendas existentes
    if (legendaAplicacao) {
        map.removeControl(legendaAplicacao);
        legendaAplicacao = null;
    }

    if (legendaComparecimento) {
        map.removeControl(legendaComparecimento);
        legendaComparecimento = null;
    }

    // Remove todas as camadas do mapa, exceto a base
    map.eachLayer(layer => {
        if (!layer._url) { // Mantenha apenas a camada base
            map.removeLayer(layer);
        }
    });

    // Atualiza o estado do mapa e exibição com base no slide atual
    if (tela === "brasil") {
        let centro = L.latLng(-15.7801, -52.9292);
        municipiosne = "";
        map.setView(centro, 4.55);
        map.addLayer(municipiosLayer);
        map.addLayer(estadosLayerBrasil);
        form.style.visibility = "visible";
        joaoFoto.style.visibility = "hidden";
        mapContainer.style.visibility = "visible";


    } else if (tela === "nordeste") {
        let centro = L.latLng(-6.473, -40.964);
        let viewbox = "-46.2815146513,-11.0683072205,-37.6352427276,-2.6773456156";
        municipiosne = "&viewbox=" + viewbox + "&bounded=1";
        map.setView(centro, 6.4);
        map.addLayer(municipiosLayer);
        map.addLayer(estadosLayerNordeste);
        form.style.visibility = "visible";
        joaoFoto.style.visibility = "hidden";
        mapContainer.style.visibility = "visible";

    } else if (tela === "barras") {
        let centro = L.latLng(-15.7801, -52.9292);
        map.setView (centro, 4.55);
        map.addLayer(estadosLayerPorcentagem);
        form.style.visibility = "hidden";
        joaoFoto.style.visibility = "hidden";
        mapContainer.style.visibility = "visible";

        const colorirEstados = d3.scaleSequential()
            .domain([15, 94])
            .interpolator(d3.interpolateGreens);

        legendaAplicacao = L.control({ position: 'bottomright' });
        legendaAplicacao.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legenda');
            const nSteps = 6;
            const stepSize = (94 - 15) / nSteps;
            let labels = [];
            for (let i = 0; i <= nSteps; i++) {
                const value = 15 + i * stepSize;
                const color = colorirEstados(value);
                labels.push(`<i style="background:${color};width:20px;height:20px;display:inline-block;"></i> ${Math.round(value)}`);
            }
            div.innerHTML = `<h4>Aplicação nos municípios (%)</h4>${labels.join('<br>')}`;
            return div;
        };
        legendaAplicacao.addTo(map);



    } else if (tela === "comparecimento") {
        let centro = L.latLng(-15.7801, -52.9292);
        map.setView(centro, 4.55);
        map.addLayer(estadosLayerComparecimento);
        form.style.visibility = "hidden";
        joaoFoto.style.visibility = "hidden";
        mapContainer.style.visibility = "visible";

        // Adiciona legenda específica para a tela "comparecimento"
        const colorScale = d3.scaleSequential()
            .domain([28, 49])
            .interpolator(d3.interpolateReds);

        legendaComparecimento = L.control({ position: 'bottomright' });
        legendaComparecimento.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            const nSteps = 6;
            const stepSize = (49 - 28) / nSteps;
            let labels = [];
            for (let i = 0; i <= nSteps; i++) {
                const value = 28 + i * stepSize;
                const color = colorScale(value);
                labels.push(`<i style="background:${color};width:20px;height:20px;display:inline-block;"></i> ${Math.round(value)}`);
            }
            div.innerHTML = `<h4>Não comparecimento (%)</h4>${labels.join('<br>')}`;
            return div;
        };
        legendaComparecimento.addTo(map);

        
    } else if (tela === "joao") {
        form.style.visibility = "none";
        joaoFoto.style.visibility = "visible";
        mapContainer.style.visibility = "hidden";
    }
}


