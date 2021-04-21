import "https://api.mapbox.com/mapbox-gl-js/v1.8.0/mapbox-gl.js";
import "https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"

// Mouse over popup https://docs.mapbox.com/mapbox-gl-js/example/popup-on-hover/

const mapboxToken = "pk.eyJ1IjoibHlyYWVkYW4iLCJhIjoiY2tucHh5dTl4MDlmdjJ1cXdjOWZvNWlweiJ9.bd_N2lhL1p9wXvbPAcyN3Q";
mapboxgl.accessToken = mapboxToken;

let covidData = undefined;

var map = new mapboxgl.Map({
	container: "map",
	style: "mapbox://styles/mapbox/streets-v11",
	center: GetUserGeolocation(),
	zoom: 2
});

map.on('load', () => {
	map.addSource('marker', {
		'type': 'geojson',
		'data': 'coords.json',
		'generateId': true
	});

	map.addLayer({
		'id': 'markers',
		'type': 'circle',
		'source': 'marker',
		'paint': {
		  'circle-stroke-color': 'black',
		  'circle-stroke-width': 1,
		  'circle-color': 'gray'
		}
	  });
});

function FetchCovidData() {
	// Fetch covid data - updated daily
	fetch("https://pomber.github.io/covid19/timeseries.json")
	.then(response => response.json())
	.then(data => {
		console.log(data);
		covidData = data;

		// Fetch geographical coordinates and place markers coloured correctly
		fetch('coords.json')
		.then(res => res.json())
		.then(coordsJson => {
			const features = coordsJson["features"];
			for(var i = 0; i < features.length; i++) {
				let properties = features[i]["properties"];
				let countryName = properties["sr_subunit"];
				let geometry = features[i]["geometry"];
				let coords = geometry["coordinates"];
				if(data[countryName] == undefined) {
					console.log(countryName + " is undefined");
				}
				placeMarkerAt(coords[0], coords[1], data[countryName]);
			}
		})
		.catch(coordsErr => {
			console.error(coordsErr);
		})
	})
	.catch(err => {
		console.error(err);
	});
}

// Create our popup but don't add it to the map
var popup = new mapboxgl.Popup({
	closeButton: false,
	closeOnClick: false
});

function placeMarkerAt(longitude, latitude, covidData) {
	var marker = new mapboxgl.Marker({
		draggable: false,
		color: InfectedCountToColor(covidData)
	})
	.setLngLat([longitude, latitude])
	.addTo(map);
}

function InfectedCountToColor(covidData) {
	if(covidData != undefined) {
		let stats = GetCountsLatest(covidData);
		let cases = stats[0];
		let deaths = stats[1];
		let recovered = stats[2];
		let infected = cases - deaths - recovered;

		let colours = [ "#FF0000", "#00FF00", "#000000" ];
		var col = (infected < recovered && infected < deaths) ? colours[2] : colours[1];
		let lerpA = lerpColor(0xFFFFFF, 0x000000, 0.5);
		console.log(lerpA);

		/*
		if(infected > recovered && infected > deaths)
			return "red";
		else if(recovered > infected && recovered > deaths)
			return "green";
		else if(deaths > infected && deaths > recovered)
			return "black";
			*/
			return "#" + lerpA;
	} else {
		return "gray";
	}
}

function GetCountsLatest(covidData) {
	var confirmed = 0;
	var deaths = 0;
	var recovered = 0;

	for(var i = 0; i < covidData.length; i++) {
		var date = covidData[i]["date"];
		const today = new Date()
		const yesterday = new Date(today)

		yesterday.setDate(yesterday.getDate() - 1);
		var comparison = (yesterday.getFullYear() +'-'+ yesterday.getMonth()) +'-'+ yesterday.getDate();
		
		if(date === comparison) {
			let c = covidData[i]["confirmed"];
			let d = covidData[i]["deaths"];
			let r = covidData[i]["recovered"];
			confirmed = c;
			deaths = d;
			recovered = r;
		}
	}
	return [ confirmed, deaths, recovered ]
}

function GetCountsPriorTo(covidData, daysFromToday) {
	var confirmed = 0;
	var deaths = 0;
	var recovered = 0;

	for(var i = 0; i < covidData.length; i++) {
		var date = covidData[i]["date"];
		const today = new Date()
		const day = new Date(today)

		day.setDate(day.getDate() - daysFromToday);
		var comparison = (day.getFullYear() +'-'+ day.getMonth()) +'-'+ day.getDate();
		
		if(date === comparison) {
			let c = covidData[i]["confirmed"];
			let d = covidData[i]["deaths"];
			let r = covidData[i]["recovered"];
			confirmed = c;
			deaths = d;
			recovered = r;
		}
	}
	return [ confirmed, deaths, recovered ]
}

map.on('mouseenter', 'markers', e => {
	map.getCanvas().style.cursor = 'pointer';

	var coords = e.features[0].geometry.coordinates.slice();
	var country = e.features[0].properties.sr_subunit;
	let html = "Failed to find covid data for <b><u>" + country + "</u></b>!";
	var covidDataEntry = covidData[country];
	if(covidDataEntry != null) {
		let stats = GetCountsLatest(covidDataEntry);
		const cases = stats[0];
		const deaths = stats[1];
		const recoveries = stats[2];
		const infected = stats[0] - stats[1] - stats[2];

		const statsAWeekAgo = GetCountsPriorTo(covidDataEntry, 7);
		const casesPrev = statsAWeekAgo[0];
		const deathsPrev = statsAWeekAgo[1];
		const recoveriesPrev = statsAWeekAgo[2];
		const infectedPrev = casesPrev - deathsPrev - recoveriesPrev;

		const casesPercentage = Math.round((casesPrev * 100) / cases);
		const deathsPercentage = Math.round((deathsPrev * 100) / deaths);
		const recoveriesPercentage = Math.round((recoveriesPrev * 100) / recoveries);
		const infectedPercentage = Math.round((infectedPrev * 100) / infected);

		$("#stats").text("Case percentage: " + casesPercentage + "% " + "Deaths percentage: " + deathsPercentage + "% " + "Recoveries percentage: " + recoveriesPercentage + "% " + "Infected percentage: " + infectedPercentage);

		html = "<b><u><p>" + country + "</p></u></b><p>Cases: " + numberWithCommas(cases) + "</p><p>Infected: " + numberWithCommas(infected) + "</p><p>Deaths: " + numberWithCommas(deaths) + "</p><p>Recoveries: " + numberWithCommas(recoveries) + "</p>";
	} else {
		$("#stats").text("No data available");
	}
	while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
		coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
	}

	popup.setLngLat(coords).setHTML(html).addTo(map);
});

map.on('mouseleave', 'markers', e => {
	map.getCanvas().style.cursor = '';
	popup.remove();
	$("#stats").text("");
});

function numberWithCommas(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function GetUserGeolocation() {
	if(navigator.geolocation) {
		return navigator.geolocation.getCurrentPosition(showPosition);
	} else {
		console.error("Geolocation is not supported by this browser!");
		return [ -1.460467598400783,
            	 52.601885382104854 ]
	}
}

function showPosition(position) {
	$("#stats").text("<p>Latitude: " + position.coords.latitude + ": Longitude: " + position.coords.longitude + "</p>");
}

function hexToRgb(hex) {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? {
	  r: parseInt(result[1], 16),
	  g: parseInt(result[2], 16),
	  b: parseInt(result[3], 16)
	} : null;
  }

function lerpColor(a, b, amount) {
    const ar = a >> 16,
          ag = a >> 8 & 0xff,
          ab = a & 0xff,

          br = b >> 16,
          bg = b >> 8 & 0xff,
          bb = b & 0xff,

          rr = ar + amount * (br - ar),
          rg = ag + amount * (bg - ag),
          rb = ab + amount * (bb - ab);

    return (rr << 16) + (rg << 8) + (rb | 0);
};

FetchCovidData();