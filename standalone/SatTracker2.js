/*
 * Copyright (C) 2014 United States Government as represented by the Administrator of the
 * National Aeronautics and Space Administration. All Rights Reserved.
 */
"use strict";

// Tell World Wind to log only warnings and errors.
WorldWind.Logger.setLoggingLevel(WorldWind.Logger.LEVEL_WARNING);

// Create the World Window.
var wwd = new WorldWind.ObjectWindow("canvasOne");
wwd.navigator.lookAtLocation.altitude = 0;
wwd.navigator.range = 5e7;

var viewControlsLayer = new WorldWind.ViewControlsLayer(wwd);
viewControlsLayer.alignment = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.25, WorldWind.OFFSET_FRACTION, 0);
viewControlsLayer.placement = new WorldWind.Offset(WorldWind.OFFSET_FRACTION, 0.25, WorldWind.OFFSET_FRACTION, 0);

//Add imagery layers.
var layers = [
    {layer: new WorldWind.BMNGLayer(), enabled: true},
    //{layer: new WorldWind.CompassLayer(), enabled: true},
    {layer: new WorldWind.CoordinatesDisplayLayer(wwd), enabled: true},
    {layer: viewControlsLayer, enabled: true}
];

for (var l = 0; l < layers.length; l++) {
    layers[l].layer.enabled = layers[l].enabled;
    wwd.addLayer(layers[l].layer);
}

//custom layers
var groundStationsLayer = new WorldWind.RenderableLayer();
var shapeLayer = new WorldWind.RenderableLayer();
var orbitsHoverLayer = new WorldWind.RenderableLayer();
var modelLayer = new WorldWind.RenderableLayer("Model");
var meshLayer = new WorldWind.RenderableLayer();
var orbitsLayer = new WorldWind.RenderableLayer("Orbit");
var leoSatLayer = new WorldWind.RenderableLayer("LEO Payloads");
var meoSatLayer = new WorldWind.RenderableLayer("MEO Payloads");
var heoSatLayer = new WorldWind.RenderableLayer("HEO Payloads");
var leoRocketLayer = new WorldWind.RenderableLayer("LEO Rocket Bodies");
var meoRocketLayer = new WorldWind.RenderableLayer("MEO Rocket Bodies");
var heoRocketLayer = new WorldWind.RenderableLayer("HEO Rocket Bodies");
var leoDebrisLayer = new WorldWind.RenderableLayer("LEO Debris");
var meoDebrisLayer = new WorldWind.RenderableLayer("MEO Debris");
var heoDebrisLayer = new WorldWind.RenderableLayer("HEO Debris");


//add custom layers
wwd.addLayer(groundStationsLayer);
wwd.addLayer(shapeLayer);
wwd.addLayer(orbitsHoverLayer);
wwd.addLayer(leoSatLayer);
wwd.addLayer(meoSatLayer);
wwd.addLayer(heoSatLayer);
wwd.addLayer(leoRocketLayer);
wwd.addLayer(meoRocketLayer);
wwd.addLayer(heoRocketLayer);
wwd.addLayer(leoDebrisLayer);
wwd.addLayer(meoDebrisLayer);
wwd.addLayer(heoDebrisLayer);
wwd.addLayer(meshLayer);
wwd.addLayer(modelLayer);
wwd.addLayer(orbitsLayer);


var payloads = [];
var rocketbodies = [];
var debris = [];
var unknown = [];

function getPosition (satrec, time) {
    var position_and_velocity = satellite.propagate(satrec,
        time.getUTCFullYear(),
        time.getUTCMonth() + 1,
        time.getUTCDate(),
        time.getUTCHours(),
        time.getUTCMinutes(),
        time.getUTCSeconds());
    var position_eci = position_and_velocity["position"];

    var gmst = satellite.gstime_from_date(time.getUTCFullYear(),
        time.getUTCMonth() + 1,
        time.getUTCDate(),
        time.getUTCHours(),
        time.getUTCMinutes(),
        time.getUTCSeconds());

    var position_gd = satellite.eci_to_geodetic(position_eci, gmst);
    var latitude = satellite.degrees_lat(position_gd["latitude"]);
    var longitude = satellite.degrees_long(position_gd["longitude"]);
    var altitude = position_gd["height"] * 1000;

    return new WorldWind.Position(latitude, longitude, altitude);
}

function sanitizeSatellites(objectArray){
  var faultySatellites = 0;
  var resultArray = [];
  var maxSats = objectArray.length;
  //console.log('Array size before splicing is ' + objectArray.length);
  for (var i = 0; i < maxSats ; i += 1){
    try{
      var position = getPosition(satellite.twoline2satrec(objectArray[i].TLE_LINE1, objectArray[i].TLE_LINE2), new Date());
    } catch (err){
      faultySatellites += 1;
      // objectArray.splice(i,1);
      // i--;
      continue;
    }
    resultArray.push(objectArray[i]);
  }
  // console.log('we have ' + objectArray.length + ' total satellites');
  // console.log(faultySatellites + ' do not work');
  // console.log('We will keep ' + resultArray.length + ' sanitized satellites.');
  return resultArray;
}

var grndStationsWorker = new Worker("Workers/groundStationsWorker.js");

grndStationsWorker.postMessage("you go first, groundstations servant!");
grndStationsWorker.addEventListener('message', function(event){
  grndStationsWorker.postMessage('close');
  getGroundStations(event.data);
}, false);

function getGroundStations (groundStations) {
  var satParserWorker = new Worker("Workers/satelliteParseWorker.js");
  satParserWorker.postMessage("work, satellite parser, work!");
  //Retrieval of JSON file data from worker threads. Also, closing such threads.
  satParserWorker.addEventListener('message', function(event){
    //var satData = event.data;
    satParserWorker.postMessage('close');
    getSatellites(event.data);
  }, false);

    function getSatellites (satellites) {
        var satPac = sanitizeSatellites(satellites);
        satPac.satDataString = JSON.stringify(satPac);
        //console.log(satPac[0].OBJECT_NAME);

        for (var i = 0; i < satPac.length; i++) {
            switch (satPac[i].OBJECT_TYPE){
                case 'PAYLOAD':
                    payloads.push(satPac[i]);
                    break;
                case 'ROCKET BODY':
                    rocketbodies.push(satPac[i]);
                    break;
                case 'DEBRIS':
                    break;
                default:
                    unknown.push(satPac[i]);
            }
        }

    //Latitude, Longitude, and Altitude
    var latitudePlaceholder = document.getElementById('latitude');
    var longitudePlaceholder = document.getElementById('longitude');
    var altitudePlaceholder = document.getElementById('altitude');
    var typePlaceholder = document.getElementById('type');
    var intldesPlaceholder = document.getElementById('intldes');
    var namePlaceholder  = document.getElementById('name');
    var inclinationPlaceholder = document.getElementById('inclination');
    var eccentricityPlaceHolder = document.getElementById('eccentricity');
    var revDayPlaceholder = document.getElementById('revDay');
    var apogeeplaceholder = document.getElementById('apogee');
    var perigeeplaceholder = document.getElementById('perigee');
    var periodPlaceholder = document.getElementById('period');
    var semiMajorAxisPlaceholder = document.getElementById('majorAxis');
    var semiMinorAxisPlaceholder = document.getElementById('minorAxis');

    //TODO: ground station info
 var gsNamePlaceHolder = document.getElementById('gsName');
 var gsOrgPlaceHolder = document.getElementById('gsOrg');
 var gsLatPlaceHolder = document.getElementById('gsLat');
 var gsLongPlaceHolder = document.getElementById('gsLong');
 var gsAltPlaceHolder = document.getElementById('gsAlt');

        function deg2text(deg, letters) {
            var letter;
            if (deg < 0) {
                letter = letters[1]
            } else {
                letter = letters[0]
            }

            var position = Math.abs(deg);

            var degrees = Math.floor(position);

            position -= degrees;
            position *= 60;

            var minutes = Math.floor(position);

            position -= minutes;
            position *= 60;

            var seconds = Math.floor(position * 100) / 100;

            return degrees + "° " + minutes + "' " + seconds + "\" " + letter;
        }

        //Display sats position
        function updateLLA(position) {
            latitudePlaceholder.textContent = deg2text(position.latitude, 'NS');
            longitudePlaceholder.textContent = deg2text(position.longitude, 'EW');
            altitudePlaceholder.textContent = (Math.round(position.altitude / 10) / 100) + "km";
        }

      // Ground Stations Layer
      var gsPlacemarkAttributes = new WorldWind.PlacemarkAttributes(null);
      var gsHighlightPlacemarkAttributes = new WorldWind.PlacemarkAttributes(gsPlacemarkAttributes);

        gsPlacemarkAttributes.imageSource = "assets/icons/ground-station.png";
      gsPlacemarkAttributes.imageScale = 0.25;
      gsPlacemarkAttributes.imageOffset = new WorldWind.Offset(
          WorldWind.OFFSET_FRACTION, 0.3,
          WorldWind.OFFSET_FRACTION, 0.0);
      gsPlacemarkAttributes.imageColor = WorldWind.Color.WHITE;
      gsPlacemarkAttributes.labelAttributes.offset = new WorldWind.Offset(
          WorldWind.OFFSET_FRACTION, 0.5,
          WorldWind.OFFSET_FRACTION, 1.0);
      gsPlacemarkAttributes.labelAttributes.color = WorldWind.Color.WHITE;

        var gsNames = [];
        var groundStation = [];
      for (var i = 0, len = groundStations.length; i < len; i++) {
          gsNames[i] = groundStations[i].NAME;

          groundStation[i] = new WorldWind.Position(groundStations[i].LATITUDE,
              groundStations[i].LONGITUDE,
              1e3);
          var gsPlacemark = new WorldWind.Placemark(groundStation[i]);

          gsPlacemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
          gsPlacemark.label = groundStation.NAME;
          gsPlacemark.attributes = gsPlacemarkAttributes;
          gsPlacemark.highlightAttributes = gsHighlightPlacemarkAttributes;
          groundStationsLayer.addRenderable(gsPlacemark);
      }
      // Add the path to a layer and the layer to the World Window's layer list.
      groundStationsLayer.displayName = "Ground Stations";
      groundStationsLayer.enabled = false;

        $('#clearStations').click(function() {
            shapeLayer.removeAllRenderables();
        });

        $(document).ready(function () {
            var url = "data/groundstations.json";
            // prepare the data
            var source =
            {
                datatype: "json",
                datafields: [
                    { name: 'NAME', type:'string'},
                    {name: 'ORGANIZATION', type:'string'}
                ],
                url: url,
                async: false
            };
            var dataAdapter = new $.jqx.dataAdapter(source);
            // Create a jqxComboBox
            $("#jqxWidget2").jqxComboBox({ selectedIndex: 0, source: dataAdapter, displayMember: "NAME", valueMember: "ORGANIZATION", width: 220, height: 30});
            // trigger the select event.
            $("#jqxWidget2").on('select', function (event) {
                if (event.args) {
                    var item = event.args.item;
                    if (item) {
                        var valueElement = $("<div></div>");
                        valueElement.text("Type: " + item.value);
                        var labelElement = $("<div></div>");
                        labelElement.text("Name: " + item.label);
                        $("#selectionlog2").children().remove();
                        $("#selectionlog2").append(labelElement);
                        $("#selectionlog2").append(valueElement);
                        var searchGSat = gsNames.indexOf(item.label);
                        toGsStation(searchGSat);
                    }
                }
            });
        });
        var toGsStation = function(gsindex){
            //TODO: GS information display
            typePlaceholder.textContent= "Ground Station";
            namePlaceholder.textContent = groundStations[gsindex].NAME;
            intldesPlaceholder.textContent = groundStations[gsindex].ORGANIZATION;
            latitudePlaceholder.textContent = groundStations[gsindex].LATITUDE;
            longitudePlaceholder.textContent = groundStations[gsindex].LONGITUDE;
            altitudePlaceholder.textContent = groundStations[gsindex].ALTITUDE;
            wwd.goTo(new WorldWind.Location(groundStations[gsindex].latitude, groundStations[gsindex].longitude));
            var gsAttributes = new WorldWind.ShapeAttributes(null);
            gsAttributes.outlineColor = new WorldWind.Color(0, 255, 255, 1);
            gsAttributes.interiorColor = new WorldWind.Color(0, 255, 255, 0.2);

            var shape = new WorldWind.SurfaceCircle(new WorldWind.Location(groundStations[gsindex].LATITUDE,
                groundStations[gsindex].LONGITUDE), 150e4, gsAttributes);

            shapeLayer.addRenderable(shape);
        };

        /***
         * Satellites
         */
        var orbitToggle = {leoP:9, leoR:0, leoD:0, meoP:9, meoR:0, meoD:0, heoP:9, heoR:0, heoD:0};
        leoDebrisLayer.enabled = false;
        meoDebrisLayer.enabled = false;
        heoDebrisLayer.enabled = false;

        var satNum = satPac.length;
        //Sat Tyoe toggles
        $('#allSats').click(function() {
            if ($(this).text() == "ALL OFF") {
                $(this).text("ALL ON");
                $('#payloads').text("PAYLOADS OFF");
                $('#rockets').text("ROCKETS OFF");
                $('#debris').text("DEBRIS OFF");
                $('#unknown').text("UNKNOWN OFF");
                $('#leo').text("LEO ON");
                $('#meo').text("MEO ON");
                $('#heo').text("HEO ON");
                leoSatLayer.enabled = true;
                leoRocketLayer.enabled = true;
                leoDebrisLayer.enabled = true;
                meoSatLayer.enabled = true;
                meoRocketLayer.enabled = true;
                meoDebrisLayer.enabled = true;
                heoSatLayer.enabled = true;
                heoRocketLayer.enabled = true;
                heoDebrisLayer.enabled = true;
                orbitToggle.leoP = 1;
                orbitToggle.leoR = 3;
                orbitToggle.leoD = 5;
                orbitToggle.meoP = 1;
                orbitToggle.meoR = 3;
                orbitToggle.meoD = 5;
                orbitToggle.heoP = 1;
                orbitToggle.heoR = 3;
                orbitToggle.heoD = 5;
                return orbitToggle;
            } else {
                $(this).text("ALL OFF");
                $('#leo').text("LEO OFF");
                $('#meo').text("MEO OFF");
                $('#heo').text("HEO OFF");
                leoSatLayer.enabled = false;
                leoRocketLayer.enabled = false;
                leoDebrisLayer.enabled = false;
                meoSatLayer.enabled = false;
                meoRocketLayer.enabled = false;
                meoDebrisLayer.enabled = false;
                heoSatLayer.enabled = false;
                heoRocketLayer.enabled = false;
                heoDebrisLayer.enabled = false;
                orbitToggle.leoP = 0;
                orbitToggle.leoR = 0;
                orbitToggle.leoD = 0;
                orbitToggle.meoP = 0;
                orbitToggle.meoR = 0;
                orbitToggle.meoD = 0;
                orbitToggle.heoP = 0;
                orbitToggle.heoR = 0;
                orbitToggle.heoD = 0;
                return orbitToggle;
            }
        });
        $('#payloads').click(function() {
            if ($(this).text() == "PAYLOADS OFF") {
                $(this).text("PAYLOADS ON");
                if ($('#allSats').text() == "ALL ON"){
                    orbitToggle.leoP = 0;
                    orbitToggle.leoR = 0;
                    orbitToggle.leoD = 0;
                    orbitToggle.meoP = 0;
                    orbitToggle.meoR = 0;
                    orbitToggle.meoD = 0;
                    orbitToggle.heoP = 0;
                    orbitToggle.heoR = 0;
                    orbitToggle.heoD = 0;

                    // leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = false;
                    // meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = false;
                    // heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = false;
                }
                $('#allSats').text("ALL OFF");
                $('#leo').text("LEO ON");
                $('#meo').text("MEO ON");
                $('#heo').text("HEO ON");
                leoSatLayer.enabled = true;
                meoSatLayer.enabled = true;
                heoSatLayer.enabled = true;
                orbitToggle.leoP = 1;
                orbitToggle.meoP = 1;
                orbitToggle.heoP = 1;
                return orbitToggle;
            } else {
                $(this).text("PAYLOADS OFF");
                orbitToggle.leoP = 0;
                orbitToggle.meoP = 0;
                orbitToggle.heoP = 0;
                leoSatLayer.enabled = false;
                meoSatLayer.enabled = false;
                heoSatLayer.enabled = false;
                return orbitToggle;
            }
        });
        $('#rockets').click(function() {
            if ($(this).text() == "ROCKETS OFF") {
                $(this).text("ROCKETS ON");
                if ($('#allSats').text() == "ALL ON"){
                    orbitToggle.leoP = 0;
                    orbitToggle.leoR = 0;
                    orbitToggle.leoD = 0;
                    orbitToggle.meoP = 0;
                    orbitToggle.meoR = 0;
                    orbitToggle.meoD = 0;
                    orbitToggle.heoP = 0;
                    orbitToggle.heoR = 0;
                    orbitToggle.heoD = 0;
                    leoSatLayer.enabled = false;
                    //leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = false;
                    meoSatLayer.enabled = false;
                    // meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = false;
                    heoSatLayer.enabled = false;
                    //heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = false;
                }
                $('#allSats').text("ALL OFF");
                $('#leo').text("LEO ON");
                $('#meo').text("MEO ON");
                $('#heo').text("HEO ON");
                leoRocketLayer.enabled = true;
                meoRocketLayer.enabled = true;
                heoRocketLayer.enabled = true;
                orbitToggle.leoR = 3;
                orbitToggle.meoR = 3;
                orbitToggle.heoR = 3;
                return orbitToggle;
            } else {
                $(this).text("ROCKETS OFF");
                orbitToggle.leoR = 0;
                orbitToggle.meoR = 0;
                orbitToggle.heoR = 0;
                leoRocketLayer.enabled = false;
                meoRocketLayer.enabled = false;
                heoRocketLayer.enabled = false;
                return orbitToggle;
            }
        });
        $('#debris').click(function() {
            if ($(this).text() == "DEBRIS OFF") {
                $(this).text("DEBRIS ON");
                if ($('#allSats').text() == "ALL ON"){
                    orbitToggle.leoP = 0;
                    orbitToggle.leoR = 0;
                    orbitToggle.leoD = 0;
                    orbitToggle.meoP = 0;
                    orbitToggle.meoR = 0;
                    orbitToggle.meoD = 0;
                    orbitToggle.heoP = 0;
                    orbitToggle.heoR = 0;
                    orbitToggle.heoD = 0;
                    leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = false;
                    //leoDebrisLayer.enabled = false;
                    meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = false;
                    // meoDebrisLayer.enabled = false;
                    heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = false;
                    // heoDebrisLayer.enabled = false;
                }
                $('#allSats').text("ALL OFF");
                $('#leo').text("LEO ON");
                $('#meo').text("MEO ON");
                $('#heo').text("HEO ON");
                leoDebrisLayer.enabled = true;
                meoDebrisLayer.enabled = true;
                heoDebrisLayer.enabled = true;
                orbitToggle.leoD = 5;
                orbitToggle.meoD = 5;
                orbitToggle.heoD = 5;
                return orbitToggle;
            } else {
                $(this).text("DEBRIS OFF");
                orbitToggle.leoD = 0;
                orbitToggle.meoD = 0;
                orbitToggle.heoD = 0;
                leoDebrisLayer.enabled = false;
                meoDebrisLayer.enabled = false;
                heoDebrisLayer.enabled = false;
                return orbitToggle;
            }
        });

        function leoToggleOn() {
            console.log(orbitToggle.leoP + orbitToggle.leoR + orbitToggle.leoD);
            switch (orbitToggle.leoP + orbitToggle.leoR + orbitToggle.leoD) {
                case 0:
                    //leoSatLayer.enabled = false;
                    //leoRocketLayer.enabled = false;
                    //leoDebrisLayer.enabled = false;
                    break;
                case 1:
                    leoSatLayer.enabled = true;
                    //leoRocketLayer.enabled = false;
                    //leoDebrisLayer.enabled = false;
                    break;
                case 3:
                    //leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = true;
                    //leoDebrisLayer.enabled = false;
                    break;
                case 5:
                    //leoSatLayer.enabled = false;
                    //leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = true;
                    break;
                case 4:
                    leoSatLayer.enabled = true;
                    leoRocketLayer.enabled = true;
                    // leoDebrisLayer.enabled = false;
                    break;
                case 6:
                    leoSatLayer.enabled = true;
                    //leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = true;
                    break;
                case 8:
                    //leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = true;
                    leoDebrisLayer.enabled = true;
                    break;
                case 9:
                    leoSatLayer.enabled = true;
                    leoRocketLayer.enabled = true;
                    leoDebrisLayer.enabled = true;
                    break;
            }
        }
        function meoToggleOn() {
            console.log(orbitToggle.meoP + orbitToggle.meoR + orbitToggle.meoD);
            switch (orbitToggle.meoP + orbitToggle.meoR + orbitToggle.meoD) {
                case 0:
                    //meoSatLayer.enabled = false;
                    //meoRocketLayer.enabled = false;
                    //meoDebrisLayer.enabled = false;
                    break;
                case 1:
                    meoSatLayer.enabled = true;
                    //meoRocketLayer.enabled = false;
                    //meoDebrisLayer.enabled = false;
                    break;
                case 3:
                    //meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = true;
                    //meoDebrisLayer.enabled = false;
                    break;
                case 5:
                    //meoSatLayer.enabled = false;
                    //meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = true;
                    break;
                case 4:
                    meoSatLayer.enabled = true;
                    meoRocketLayer.enabled = true;
                    // leoDebrisLayer.enabled = false;
                    break;
                case 6:
                    leoSatLayer.enabled = true;
                    //meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = true;
                    break;
                case 8:
                    //meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = true;
                    meoDebrisLayer.enabled = true;
                    break;
                case 9:
                    meoSatLayer.enabled = true;
                    meoRocketLayer.enabled = true;
                    meoDebrisLayer.enabled = true;
                    break;
            }
        }
        function heoToggleOn() {
            console.log(orbitToggle.heoP + orbitToggle.heoR + orbitToggle.heoD);
            switch (orbitToggle.heoP + orbitToggle.heoR + orbitToggle.heoD) {
                case 0:
                    //heoSatLayer.enabled = false;
                    //heoRocketLayer.enabled = false;
                    //heoDebrisLayer.enabled = false;
                    break;
                case 1:
                    heoSatLayer.enabled = true;
                    //heoRocketLayer.enabled = false;
                    //heoDebrisLayer.enabled = false;
                    break;
                case 3:
                    //heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = true;
                    //heoDebrisLayer.enabled = false;
                    break;
                case 5:
                    //heoSatLayer.enabled = false;
                    //heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = true;
                    break;
                case 4:
                    heoSatLayer.enabled = true;
                    heoRocketLayer.enabled = true;
                    // heoDebrisLayer.enabled = false;
                    break;
                case 6:
                    heoSatLayer.enabled = true;
                    //heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = true;
                    break;
                case 8:
                    //heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = true;
                    heoDebrisLayer.enabled = true;
                    break;
                case 9:
                    heoSatLayer.enabled = true;
                    heoRocketLayer.enabled = true;
                    heoDebrisLayer.enabled = true;
                    break;
            }
        }

        function leoToggleOff() {
            console.log(orbitToggle.leoP + orbitToggle.leoR + orbitToggle.leoD);
            switch (orbitToggle.leoP + orbitToggle.leoR + orbitToggle.leoD) {
                case 0:
                    leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = false;
                    break;
                case 1:
                    leoSatLayer.enabled = false;
                    //leoRocketLayer.enabled = false;
                    //leoDebrisLayer.enabled = false;
                    break;
                case 3:
                    //leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = false;
                    //leoDebrisLayer.enabled = false;
                    break;
                case 5:
                    //leoSatLayer.enabled = false;
                    //leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = false;

                    break;
                case 4:
                    leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = false;
                    // leoDebrisLayer.enabled = false;

                    break;
                case 6:
                    leoSatLayer.enabled = false;
                    //leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = false;
                    break;
                case 8:
                    //leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = false;
                    break;
                case 9:
                    leoSatLayer.enabled = false;
                    leoRocketLayer.enabled = false;
                    leoDebrisLayer.enabled = false;
                    break;
            }
        }
        function meoToggleOff() {
            switch (orbitToggle.meoP + orbitToggle.meoR + orbitToggle.meoD) {
                case 0:
                    meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = false;
                    break;
                case 1:
                    meoSatLayer.enabled = false;
                    //meoRocketLayer.enabled = false;
                    //meoDebrisLayer.enabled = false;
                    break;
                case 3:
                    //meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = false;
                    //meoDebrisLayer.enabled = false;
                    break;
                case 5:
                    //meoSatLayer.enabled = false;
                    //meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = false;

                    break;
                case 4:
                    meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = false;
                    // meoDebrisLayer.enabled = false;

                    break;
                case 6:
                    meoSatLayer.enabled = false;
                    //meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = false;
                    break;
                case 8:
                    //meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = false;
                    break;
                case 9:
                    meoSatLayer.enabled = false;
                    meoRocketLayer.enabled = false;
                    meoDebrisLayer.enabled = false;
                    break;
            }
        }
        function heoToggleOff() {
            switch (orbitToggle.heoP + orbitToggle.heoR + orbitToggle.heoD) {
                case 0:
                    heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = false;
                    break;
                case 1:
                    heoSatLayer.enabled = false;
                    //heoRocketLayer.enabled = false;
                    //heoDebrisLayer.enabled = false;
                    break;
                case 3:
                    //heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = false;
                    //heoDebrisLayer.enabled = false;
                    break;
                case 5:
                    //heoSatLayer.enabled = false;
                    //heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = false;

                    break;
                case 4:
                    heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = false;
                    // heoDebrisLayer.enabled = false;

                    break;
                case 6:
                    heoSatLayer.enabled = false;
                    //heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = false;
                    break;
                case 8:
                    //heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = false;
                    break;
                case 9:
                    heoSatLayer.enabled = false;
                    heoRocketLayer.enabled = false;
                    heoDebrisLayer.enabled = false;
                    break;
            }
        }

        //Range Toggles
        $('#leo').click(function() {
            if ($(this).text() == "LEO OFF") {
                $(this).text("LEO ON");
                leoToggleOn();
            } else {
                $(this).text("LEO OFF");
                leoToggleOff();
            }
        });
        $('#meo').click(function() {
            if ($(this).text() == "MEO OFF") {
                $(this).text("MEO ON");
                meoToggleOn();
            } else {
                $(this).text("MEO OFF");
                meoToggleOff();
            }
        });
        $('#heo').click(function() {
            if ($(this).text() == "HEO OFF") {
                $(this).text("HEO ON");
                heoToggleOn();
            } else {
                $(this).text("HEO OFF");
                heoToggleOff();
            }
        });

        $('#gStations').click(function() {
            if ($(this).text() == "GS OFF") {
                $(this).text("GS ON");
                groundStationsLayer.enabled = true;
            } else {
                $(this).text("GS OFF");
                groundStationsLayer.enabled = false;
            }
        });
        selectSat(satPac);

        function selectSat(satData) {
            var satNames = [];
            var now = new Date();
            var everyCurrentPosition = [];


            for (var j = 0; j < satNum; j ++) {
                var currentPosition = null;
                var time = new Date(now.getTime() + i * 60000);
                var position = getPosition(satellite.twoline2satrec(satData[j].TLE_LINE1, satData[j].TLE_LINE2), time);
                currentPosition = new WorldWind.Position(position.latitude,
                    position.longitude,
                    position.altitude);
                everyCurrentPosition[j] = currentPosition;
                satNames[j] = satData[j].OBJECT_NAME;

                var placemarkAttributes = new WorldWind.PlacemarkAttributes(null);
                var highlightPlacemarkAttributes = new WorldWind.PlacemarkAttributes(placemarkAttributes);
                highlightPlacemarkAttributes.imageScale = 0.50;
               // highlightPlacemarkAttributes.imageSource = "assets/icons/satellite.png";

                //add colored image depending on sat type
                switch(satData[j].OBJECT_TYPE) {
                    case "PAYLOAD":
                        placemarkAttributes.imageSource = "assets/icons/dot-red.png";
                        placemarkAttributes.imageScale = 0.60;
                        break;
                    case "ROCKET BODY":
                        placemarkAttributes.imageSource = "assets/icons/dot-blue.png";
                        placemarkAttributes.imageScale = 0.60;
                        break;
                    default:
                        placemarkAttributes.imageSource = "assets/icons/dot-gray.png";
                        placemarkAttributes.imageScale = 0.40;
                }

                placemarkAttributes.imageOffset = new WorldWind.Offset(
                    WorldWind.OFFSET_FRACTION, 0.5,
                    WorldWind.OFFSET_FRACTION, 0.5);
                placemarkAttributes.imageColor = WorldWind.Color.WHITE;
                placemarkAttributes.labelAttributes.offset = new WorldWind.Offset(
                    WorldWind.OFFSET_FRACTION, 0.5,
                    WorldWind.OFFSET_FRACTION, 1.0);
                placemarkAttributes.labelAttributes.color = WorldWind.Color.WHITE;


                var placemark = new WorldWind.Placemark(everyCurrentPosition[j]);
                placemark.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                placemark.attributes = placemarkAttributes;
                placemark.highlightAttributes = highlightPlacemarkAttributes;


                //Defines orbit ranges
                if (satData[j].OBJECT_TYPE === "PAYLOAD") {
                    if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) <= 1200) {
                        leoSatLayer.addRenderable(placemark);
                    } else if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) > 1200 && (Math.round(everyCurrentPosition[j].altitude / 10) / 100) <= 35790) {
                        meoSatLayer.addRenderable(placemark);
                    } else if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) > 35790) {
                        heoSatLayer.addRenderable(placemark);
                    }
                } else if (satData[j].OBJECT_TYPE === "ROCKET BODY") {
                    if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) <= 1200) {
                        leoRocketLayer.addRenderable(placemark);
                    } else if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) > 1200 && (Math.round(everyCurrentPosition[j].altitude / 10) / 100) <= 35790) {
                        meoRocketLayer.addRenderable(placemark);
                    } else if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) > 35790) {
                        heoRocketLayer.addRenderable(placemark);
                    }
                } else if (satData[j].OBJECT_TYPE === "DEBRIS") {
                    if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) <= 1200) {
                        leoDebrisLayer.addRenderable(placemark);
                    } else if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) > 1200 && (Math.round(everyCurrentPosition[j].altitude / 10) / 100) <= 35790) {
                        meoDebrisLayer.addRenderable(placemark);
                    } else if ((Math.round(everyCurrentPosition[j].altitude / 10) / 100) > 35790) {
                        heoDebrisLayer.addRenderable(placemark);
                    }
                }
            }

            $(document).ready(function () {
                var url = "data/TLE.json";
                // prepare the data
                var source =
                {
                    datatype: "json",
                    datafields: [
                        { name: 'OBJECT_NAME', type:'string'},
                        {name: 'OBJECT_TYPE', type:'string'}
                    ],
                    url: url,
                    async: false
                };
                var dataAdapter = new $.jqx.dataAdapter(source);
                // Create a jqxComboBox
                $("#jqxWidget").jqxComboBox({ selectedIndex: 0, source: dataAdapter, displayMember: "OBJECT_NAME", valueMember: "OBJECT_TYPE", width: 220, height: 30});
                // trigger the select event.
                $("#jqxWidget").on('select', function (event) {
                    if (event.args) {
                        var item = event.args.item;
                        if (item) {
                            var valueElement = $("<div></div>");
                            valueElement.text("Type: " + item.value);
                            var labelElement = $("<div></div>");
                            labelElement.text("Name: " + item.label);
                            $("#selectionlog").children().remove();
                            $("#selectionlog").append(labelElement);
                            $("#selectionlog").append(valueElement);
                            console.log(item.label);
                            console.log(satNames[1]);
                            endFollow();
                            endMesh();
                            endOrbit();
                            endExtra();
                            var searchSat = satNames.indexOf(item.label);
                            console.log(searchSat);
                            toCurrentPosition(searchSat);
                            meshToCurrentPosition(searchSat);
                            createOrbit(searchSat);
                            extraData(searchSat);
                            createCollada(searchSat);
                            typePlaceholder.textContent = satData[searchSat].OBJECT_TYPE;
                            intldesPlaceholder.textContent = satData[searchSat].INTLDES;
                            namePlaceholder.textContent = satData[searchSat].OBJECT_NAME;

                        }
                    }
                });
            });

            // Draw
            wwd.redraw();

            // Update all Satellite Positions
             window.setInterval(function () {
                for (var indx = 0; indx < satNum; indx += 1) {
                    var position = getPosition(satellite.twoline2satrec(satData[indx].TLE_LINE1, satData[indx].TLE_LINE2), new Date());
                    everyCurrentPosition[indx].latitude = position.latitude;
                    everyCurrentPosition[indx].longitude = position.longitude;
                    everyCurrentPosition[indx].altitude = position.altitude;
                }
                wwd.redraw();
            }, 1000);

            /****
             * Satellite click-handle functions
             */
                //follow satellite on click
                // Move to sat position on click and redefine navigator positioning
            var startFollow;
            var toCurrentPosition = function (index) {
                var satPos = everyCurrentPosition[index];
                //Changes center point of view.
                wwd.navigator.lookAtLocation.altitude = satPos.altitude;
                startFollow = window.setInterval(function () {
                        var position = getPosition(satellite.twoline2satrec(satData[index].TLE_LINE1, satData[index].TLE_LINE2), new Date());
                        //change view position
                        wwd.navigator.lookAtLocation.latitude = satPos.latitude;
                        wwd.navigator.lookAtLocation.longitude = satPos.longitude;
                        updateLLA(position);
                    });
            };
            var endFollow = function(){     //ends startFollow window.setInterval
                clearInterval(startFollow);
            };
            $('#follow').click(function () {
                endFollow();
            });

            //Mesh-cone to follow sat position
            var startMesh;                                    //allows to end window interval
            var meshToCurrentPosition = function (index) {
                startMesh = window.setInterval(function () {
                    meshLayer.removeAllRenderables();
                    var attributes = new WorldWind.ShapeAttributes(null);
                    attributes.outlineColor = new WorldWind.Color(28, 255, 47, 1);
                    attributes.interiorColor = new WorldWind.Color(28, 255, 47, 0.1);

                    var shape = new WorldWind.SurfaceCircle(new WorldWind.Location(everyCurrentPosition[index].latitude,
                        everyCurrentPosition[index].longitude), 150e4, attributes);

                    meshLayer.addRenderable(shape);
                });
            };
            var endMesh = function () {
                meshLayer.removeAllRenderables();
                clearInterval(startMesh);
            };

            //Orbit length/time slider
          $(document).ready(function () {
            $("#jqxsliderEvent").jqxSlider({ theme: 'summer', value: 98, max: 10080, min: 0, mode: 'fixed', ticksFrequency: 1440 });
            $('#jqxsliderEvent').bind('change', function (event) {
              $('#sliderValue').html(new Date(now.getTime() + event.args.value * 60000));
              $('#sliderValue2').html('Mins: ' + event.args.value);

            });
          });

          //create past and future orbit on click
            var startOrbit;
            var createOrbit = function(index) {
                startOrbit = window.setInterval(function() {
                  var orbitRange = $('#jqxsliderEvent').jqxSlider('value');
                    orbitsLayer.removeAllRenderables();
                    var now = new Date();
                    var pastOrbit = [];
                    var futureOrbit = [];
                    for (var i = -orbitRange; i <= orbitRange; i++) {
                        var time = new Date(now.getTime() + i * 60000);

                        var position = getPosition(satellite.twoline2satrec(satData[index].TLE_LINE1, satData[index].TLE_LINE2), time);

                        if (i <= 0) {
                            pastOrbit.push(position);
                        }
                        if (i >= 0) {
                            futureOrbit.push(position);
                        }
                    }

                    // Orbit Path
                    var pastOrbitPathAttributes = new WorldWind.ShapeAttributes(null);
                    pastOrbitPathAttributes.outlineColor = WorldWind.Color.RED;
                    pastOrbitPathAttributes.interiorColor = new WorldWind.Color(1, 0, 0, 0.5);

                    var futureOrbitPathAttributes = new WorldWind.ShapeAttributes(null);//pastAttributes
                    futureOrbitPathAttributes.outlineColor = WorldWind.Color.GREEN;
                    futureOrbitPathAttributes.interiorColor = new WorldWind.Color(0, 1, 0, 0.5);

                    //plot orbit on click
                    var pastOrbitPath = new WorldWind.Path(pastOrbit);
                    pastOrbitPath.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                    pastOrbitPath.attributes = pastOrbitPathAttributes;


                    var futureOrbitPath = new WorldWind.Path(futureOrbit);
                    futureOrbitPath.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                    futureOrbitPath.attributes = futureOrbitPathAttributes;

                    orbitsLayer.addRenderable(pastOrbitPath);
                    orbitsLayer.addRenderable(futureOrbitPath);
                });
            };
            var endOrbit = function(){
                orbitsLayer.removeAllRenderables();
                clearInterval(startOrbit);
            };

            //Get additional info of satellite on click and hover handles
            var startExtra;
            var extraData = function(index) {
                startExtra = window.setInterval(function() {
                    var satStuff = satellite.twoline2satrec( //perform and store sat init calcs
                        satData[index].TLE_LINE1, satData[index].TLE_LINE2);
                    var extra = {};
                    //keplerian elements
                    extra.inclination = satStuff.inclo;  //rads
                    extra.eccentricity = satStuff.ecco;
                    extra.raan = satStuff.nodeo;   //rads
                    extra.argPe = satStuff.argpo;  //rads
                    extra.meanMotion = satStuff.no * 60 * 24 / (2 * Math.PI);     // convert rads/minute to rev/day

                    //fun other data
                    extra.semiMajorAxis = Math.pow(8681663.653 / extra.meanMotion, (2 / 3));
                    extra.semiMinorAxis = extra.semiMajorAxis * Math.sqrt(1 - Math.pow(extra.eccentricity, 2));
                    extra.apogee = extra.semiMajorAxis * (1 + extra.eccentricity) - 6371;
                    extra.perigee = extra.semiMajorAxis * (1 - extra.eccentricity) - 6371;
                    extra.period = 1440.0 / extra.meanMotion;

                    inclinationPlaceholder.textContent = extra.inclination;
                    eccentricityPlaceHolder.textContent = extra.eccentricity;
                    revDayPlaceholder.textContent = extra.meanMotion;
                    apogeeplaceholder.textContent = extra.apogee;
                    perigeeplaceholder.textContent = extra.perigee;
                    periodPlaceholder.textContent = extra.period;
                    semiMajorAxisPlaceholder.textContent = extra.semiMajorAxis;
                    semiMinorAxisPlaceholder.textContent = extra.semiMinorAxis;
                });
            };
            var endExtra = function(){
                clearInterval(startExtra);
            };

          //create 3D collada model
          var createCollada = function(index) {
            var satPos = everyCurrentPosition[index];
            var colladaLoader = new WorldWind.ColladaLoader(satPos);
            colladaLoader.init({dirPath: 'assets/collada-models/'});
            colladaLoader.load('ISS.dae', function (scene) {
              scene.scale = 10000;
              modelLayer.addRenderable(scene);
            });
          };


    /**
     * Click-handle
     *
     */
            //Highlighting
            // Now set up to handle picking.
            var highlightedItems = [];

            var handleClick = function (recognizer) {
                // The input argument is either an Event or a TapRecognizer. Both have the same properties for determining
                // the mouse or tap location.
                var x = recognizer.clientX,
                    y = recognizer.clientY;

                var redrawRequired = highlightedItems.length > 0;

                // De-highlight any highlighted placemarks.
                index = null;
                for (var h = 0; h < highlightedItems.length; h++) {
                    highlightedItems[h].highlighted = false;
                    orbitsHoverLayer.enabled = true;
                    endHoverOrbit();
                    endOrbit();
                    endMesh();
                    endFollow();
                    endExtra();
                    $('#follow').text('FOLLOW OFF');
                    $('#mesh').text('MESH OFF');
                    $('#orbit').text('ORBIT OFF');

                    //turns off renderables that were turned on by click
                    modelLayer.removeAllRenderables();
                }
               // highlightedItems = [];

                // Perform the pick. Must first convert from window coordinates to canvas coordinates, which are
                // relative to the upper left corner of the canvas rather than the upper left corner of the page.
                var rectRadius = 2,
                    pickPoint = wwd.canvasCoordinates(x, y),
                    pickRectangle = new WorldWind.Rectangle(pickPoint[0] - rectRadius, pickPoint[1] + rectRadius,
                        2 * rectRadius, 2 * rectRadius);

                var pickList = wwd.pick(wwd.canvasCoordinates(x, y));

                // If only one thing is picked and it is the terrain, tell the world window to go to the picked location.
                if (pickList.objects.length == 1 && pickList.objects[0].isTerrain) {
                    var position = pickList.objects[0].position;
                    index = null;
                    orbitsHoverLayer.removeAllRenderables();
                    orbitsHoverLayer.enabled = true;
                    endHoverOrbit();
                    endExtra();
                    endFollow();
                    endOrbit();
                    endMesh();
                    $('#follow').text('FOLLOW OFF');
                    $('#mesh').text('MESH OFF');
                    $('#orbit').text('ORBIT OFF');

                    wwd.goTo(new WorldWind.Location(position.latitude, position.longitude));

                }

                var pickList = wwd.pickShapesInRegion(pickRectangle);
                if (pickList.objects.length > 0) {
                    redrawRequired = true;
                }

                // Highlight the items picked.
                if (pickList.objects.length > 0) {
                    for (var p = 0; p < pickList.objects.length; p++) {
                        if (pickList.objects[p].isOnTop) {
                            pickList.objects[p].userObject.highlighted = true;
                            highlightedItems.push(pickList.objects[p].userObject);
                        }

                    }
                }


                if (pickList.objects.length == 1 && pickList.objects[0]) {
                    var position = pickList.objects[0].position;
                    if (position.altitude > 1000) {
                        var index = everyCurrentPosition.indexOf(position);
                        var satPos = everyCurrentPosition[index];
                        orbitsHoverLayer.enabled = false;

                        endFollow();
                        endHoverOrbit();
                        endMesh();
                        endExtra();
                        endOrbit();

                        extraData(index);
                        $('#mesh').text("MESH ON");
                        meshToCurrentPosition(index);
                        $('#mesh').click(function () {
                            if ($(this).text() == "MESH OFF") {
                                $(this).text("MESH ON");
                                meshToCurrentPosition(index);
                            }
                            else {
                                $(this).text("MESH OFF");
                                endMesh();
                            }
                        });

                        wwd.goTo(new WorldWind.Position(satPos.latitude, satPos.longitude, satPos.altitude + 10000));
                        window.setTimeout(function () {     //delays navigator position change for smooth transition
                            toCurrentPosition(index);
                        }, 3000);
                        $('#follow').text('FOLLOW ON');
                        $('#follow').click(function () {
                            if ($(this).text() == "FOLLOW OFF") {
                                $(this).text("FOLLOW ON");
                                toCurrentPosition(index);
                            }
                            else {
                                $(this).text("FOLLOW OFF");
                                endFollow();
                            }
                        });


                        createOrbit(index);
                        $('#orbit').text('ORBIT ON');
                        $('#orbit').click(function () {
                            if ($(this).text() == "ORBIT OFF") {
                                $(this).text("ORBIT ON");
                                createOrbit(index);
                            }
                            else {
                                $(this).text("ORBIT OFF");
                                endOrbit();
                            }
                        });

                      createCollada();

                    } else {

                        var gsindex = groundStation.indexOf(position);
                        toGsStation(gsindex);
                    }
                }

                // Update the window if we changed anything.
                if (redrawRequired) {
                    wwd.redraw();
                }
            };

            // Listen for mouse clicks.
            var clickRecognizer = new WorldWind.ClickRecognizer(wwd, handleClick);

            // Listen for taps on mobile devices.
            var tapRecognizer = new WorldWind.TapRecognizer(wwd, handleClick);

            /**
             * Pick-Handle Functions
             *
             */
            var startHoverOrbit;
            var createHoverOrbit = function(index) {
                startHoverOrbit = window.setInterval(function() {
                    orbitsHoverLayer.removeAllRenderables();
                    var now = new Date();
                    var pastOrbit = [];
                    var futureOrbit = [];
                    for (var i = -98; i <= 98; i++) {
                        var time = new Date(now.getTime() + i * 60000);

                        var position = getPosition(satellite.twoline2satrec(satData[index].TLE_LINE1, satData[index].TLE_LINE2), time);

                        if (i < 0) {
                            pastOrbit.push(position);
                        } else if (i > 0) {
                            futureOrbit.push(position);
                        } else {
                            pastOrbit.push(position);
                            futureOrbit.push(position);
                        }
                    }

                    // Orbit Path
                    var pastOrbitPathAttributes = new WorldWind.ShapeAttributes(null);
                    pastOrbitPathAttributes.outlineColor = WorldWind.Color.RED;
                    pastOrbitPathAttributes.interiorColor = new WorldWind.Color(1, 0, 0, 0.5);

                    var futureOrbitPathAttributes = new WorldWind.ShapeAttributes(null);//pastAttributes
                    futureOrbitPathAttributes.outlineColor = WorldWind.Color.GREEN;
                    futureOrbitPathAttributes.interiorColor = new WorldWind.Color(0, 1, 0, 0.5);

                    //plot orbit on click
                    var pastOrbitPath = new WorldWind.Path(pastOrbit);
                    pastOrbitPath.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                    pastOrbitPath.attributes = pastOrbitPathAttributes;


                    var futureOrbitPath = new WorldWind.Path(futureOrbit);
                    futureOrbitPath.altitudeMode = WorldWind.RELATIVE_TO_GROUND;
                    futureOrbitPath.attributes = futureOrbitPathAttributes;

                    orbitsHoverLayer.addRenderable(pastOrbitPath);
                    orbitsHoverLayer.addRenderable(futureOrbitPath);
                });
            };
            var endHoverOrbit = function(){
                clearInterval(startHoverOrbit);
                orbitsHoverLayer.removeAllRenderables();
            };


            /**
             * Pick-handle
             *
             */
            //Highlight on hover
            // Now set up to handle picking.
            var highlightedItems = [];

            var handlePick = function (recognizer) {
                // The input argument is either an Event or a TapRecognizer. Both have the same properties for determining
                // the mouse or tap location.
                var x = recognizer.clientX,
                    y = recognizer.clientY;

                var redrawRequired = highlightedItems.length > 0;

                // De-highlight any highlighted placemarks.
                for (var h = 0; h < highlightedItems.length; h++) {
                    highlightedItems[h].highlighted = false;
                    endExtra();
                    endHoverOrbit();

                }
                highlightedItems = [];

                // Perform the pick. Must first convert from window coordinates to canvas coordinates, which are
                // relative to the upper left corner of the canvas rather than the upper left corner of the page.
                var rectRadius = 1,
                    pickPoint = wwd.canvasCoordinates(x, y),
                    pickRectangle = new WorldWind.Rectangle(pickPoint[0] - rectRadius, pickPoint[1] + rectRadius,
                        2 * rectRadius, 2 * rectRadius);

                var pickList = wwd.pickShapesInRegion(pickRectangle);
                if (pickList.objects.length > 0) {
                    redrawRequired = true;
                }


                // Highlight the items picked.
                if (pickList.objects.length > 0) {
                    for (var p = 0; p < pickList.objects.length; p++) {
                        if (pickList.objects[p].isOnTop) {
                            pickList.objects[p].userObject.highlighted = true;
                            highlightedItems.push(pickList.objects[p].userObject);
                        }

                    }
                }

                if (pickList.objects.length == 1 && pickList.objects[0]) {
                    var position = pickList.objects[0].position;
                    console.log(position);
                    if (position.altitude > 1000) {
                        var index = everyCurrentPosition.indexOf(position);
                        try {
                            typePlaceholder.textContent = satData[index].OBJECT_TYPE;
                            intldesPlaceholder.textContent = satData[index].INTLDES;
                            namePlaceholder.textContent = satData[index].OBJECT_NAME;
                        } catch (err) {
                            console.log('error in index ' + index);
                        }
                        endExtra();
                        endHoverOrbit();
                        extraData(index);

                        createHoverOrbit(index);

                        updateLLA(everyCurrentPosition[index]);
                    } else {
                        var gsindex = groundStation.indexOf(position);
                        typePlaceholder.textContent= "Ground Station";
                        namePlaceholder.textContent = groundStations[gsindex].NAME;
                        intldesPlaceholder.textContent = groundStations[gsindex].ORGANIZATION;
                        latitudePlaceholder.textContent = groundStations[gsindex].LATITUDE;
                        longitudePlaceholder.textContent = groundStations[gsindex].LONGITUDE;
                        altitudePlaceholder.textContent = groundStations[gsindex].ALTITUDE;
                        inclinationPlaceholder.textContent = "";
                        eccentricityPlaceHolder.textContent = "";
                        revDayPlaceholder.textContent = "";
                        apogeeplaceholder.textContent = "";
                        perigeeplaceholder.textContent = "";
                        periodPlaceholder.textContent = "";
                        semiMajorAxisPlaceholder.textContent = "";
                        semiMinorAxisPlaceholder.textContent = "";
                    }

                    // Update the window if we changed anything.
                    if (redrawRequired) {
                        wwd.redraw();
                    }
                }
            };


            // Listen for mouse moves and highlight the placemarks that the cursor rolls over.
            wwd.addEventListener("mousemove", handlePick);

            // Listen for taps on mobile devices and highlight the placemarks that the user taps.
            var tapRecognizer = new WorldWind.TapRecognizer(wwd, handlePick);

            wwd.redraw();
        }
    }
}
var layerManger = new LayerManager(wwd);
wwd.redraw();
