//==================================================================//

function MapView(maperial, map, options, config){

   //--------------------------------------------------------------//
   
   options                 = options || {}
   options.type            = options.type ?           (options.type == Maperial.MAIN || options.type == Maperial.ANCHOR || options.type == Maperial.LENS || options.type == Maperial.MINIFIER || options.type == Maperial.MAGNIFIER ? options.type : Maperial.ANCHOR) : Maperial.ANCHOR
   options.width           = options.width            || 150
   options.height          = options.height           || 150
   options.position        = options.position         || { left : 0, top : 0 }
   options.opacity         = options.opacity          || 1
   options.padding         = options.padding          || 0
   options.borderRadius    = options.borderRadius     || 0

   if(options.type == Maperial.ANCHOR){
      options.zoomable = true
      options.deltaZoom = 0
   }

   console.log("  prepare MapView ", map, options)
   
   //--------------------------------------------------------------//

   this.maperial           = maperial
   this.map                = map
   this.options            = options;
   this.config             = config;

   this.context            = null;

   this.type               = options.type
   this.name               = ((options && options.name)  ? options.name : Utils.generateGuid()) + "_" + this.map
   
   this.zoomable           = (options && options.zoomable != null) ? options.zoomable : true
   this.deltaZoom          = (options && options.deltaZoom != null) ? options.deltaZoom : 0

   //--------------------------------------------------------------//

   this.hud                = new HUD( this );

   this.mapRenderer        = null;
   this.mapMover           = null;
   this.mapMouse           = null;

   this.stylesManager      = null;
   this.colorbarsManager   = null;
   this.layersManager      = null;

   this.geoloc             = null;
   this.styleMenu          = null;
   this.colorbarRenderer   = null;
   
   //--------------------------------------------------------------//
   
   this.shaders            = [Maperial.AlphaClip, Maperial.AlphaBlend, Maperial.MulBlend];

   //--------------------------------------------------------------//
};

//==================================================================//

MapView.prototype.build = function(){
   console.log("MapView", this.name, "starts building", this.config);
   this.checkConfig();
   this.restart();
}

//==================================================================//

/**
 * Must be called whenever the config is changed, in order to build MapView again
 */
MapView.prototype.restart = function(){
   console.log("MapView restarts ", this.name, this.type, this.config);
   $(window).trigger(MaperialEvents.VIEW_LOADING, [this.name]);
   this.reset();
   this.load();
}

//==================================================================//

MapView.prototype.reset = function(){

   console.log("Reset MapView...");

   try{
      if(this.mapRenderer){
         this.mapRenderer.Stop();
         this.mapRenderer.reset();
      }
   }catch(e){
   }

   try{
      if(this.mapMover)
         this.mapMover.removeListeners();
      
      if(this.mapMouse)
         this.mapMouse.removeListeners();
      
      if(this.hud)
         this.hud.reset();
   }catch(e){
   }

   try{
      if(this.styleMenu)
         this.styleMenu.removeListeners();
   }catch(e){}

   try{
      if(this.maperial.sourcesManager)
         this.maperial.sourcesManager.releaseReceiver(this.name);
   }catch(e){
   }
   
   this.colorbarsManager = new ColorbarsManager(this);
   this.stylesManager = new StylesManager(this);
   this.layersManager = new LayersManager(this);
   
   this.maperial.sourcesManager.addReceiver(this)

   for(var i = 0; i < this.config.layers.length; i++){
      if(this.config.layers[i].source.type == Source.WMS){
         this.centerWMS( this.config.layers[i].source.params.src, "prepare" )
      }
   }
   
   console.log("stylesCache : ", window.maperialViewStyles);
   console.log("sourcesManager : ", this.maperial.sourcesManager);
}

//==================================================================//

MapView.prototype.load = function() {

   console.log("Starting MapViewJS build...");

   //--------------------------//

   this.maperial.templateBuilder.build(this);
   this.createContext();

   //--------------------------//
   // After having checked the config, there still may be no layers.
   // For instance in webapp.map.layersCreation the user may remove every layers.

   if(this.config.layers.length > 0){
      var mapView = this;
      mapView.loadStyles(function(){
         mapView.loadColorbars(function(){
            mapView.checkOSMSets();
            mapView.buildAll();
         });
      });
   }
   else{
      this.buildHUD();
      this.finishStartup();
   }
}

//==================================================================//

MapView.prototype.checkConfig = function() {

   console.log("checking config...");
   odump(this.config)

   //--------------------------//
   // checking default objects

   if(!this.config)
      this.config = this.defaultConfig();

   if(!this.config.hud)
      this.config.hud = {elements:{}, options:{}};

   if(!this.config.map)
      this.config.map = {};

   if(!this.config.layers)
      this.config.layers = [];

   //--------------------------//
   // checking layer config
   if(this.config.layers.length == 0){
      if(this.config.map.layersCreation){
         console.log("  using no layer...");
      }
      else{
         console.log("  using default layers...");
         this.config.layers.push(LayersManager.getOSMLayerConfig());
      }      
   }
   else{
      console.log("  using custom layers...");
      this.checkIds()
   }

   //--------------------------//
   // checking if Default style must be used

   //this.changeStyle(Maperial.DEFAULT_STYLE_UID, 0, false);
}

/**
 * to get source.id for old layers
 * TMP : ids should be ok for maps from now on
 */
MapView.prototype.checkIds = function() {

   for(var i = 0; i < this.config.layers.length; i++){
      
      //--> Map having no source.id
      if(!this.config.layers[i].source.id){
         console.log("  -------> OLD MAP -------> looking for id...");
         
         switch(this.config.layers[i].source.type){
            case Source.MaperialOSM:
               this.config.layers[i].source.id = this.config.layers[i].params.styles[this.config.layers[i].params.selectedStyle]
               break;

            case Source.SRTM:
               this.config.layers[i].source.id = Source.SRTM
               break;

            case Source.Raster:
               this.config.layers[i].source.id = this.config.layers[i].source.params.uid
               break;

            case Source.Images:
            case Source.WMS:
               this.config.layers[i].source.id = this.config.layers[i].source.params.src
               break;
         }
      }

      //--> Map having shade --> now source.SRTM
      else if(this.config.layers[i].source.id == "shade"){
         console.log("  -------> OLD MAP with shade -------> switching to SRTM...");
         this.config.layers[i].source.type = Source.SRTM
         this.config.layers[i].source.id   = Source.SRTM
      }
   }
}

//==================================================================//

MapView.prototype.createContext = function() {

   if(!this.context){
      console.log("creating context...");

      this.context         = {};
      this.context.coordS  = new CoordinateSystem ( Maperial.tileSize );
   }
   else
      console.log("reset context...");

   //----------------------------------------------------------

   this.context.centerM    = this.context.coordS.LatLonToMeters( this.startLatitude() , this.startLongitude() );
   this.context.mouseM     = this.context.centerM;     // Mouse coordinates in meters
   this.context.mouseP     = null;                     // Mouse coordinates inside the canvas
   this.context.zoom       = this.startZoom();

   //----------------------------------------------------------
   // set new divs (ember erase and build new divs)

   this.context.mapCanvas = $("#Map_"+this.name);
   this.context.mapLeaflet = $("#MapLeaflet_"+this.name);
   this.setCanvasSize();

   if(this.config.hud.elements[HUD.MAGNIFIER]){
      this.context.magnifierCanvas = $("#Magnifier"+this.name);
   }

   //----------------------------------------------------------
}

MapView.prototype.startLatitude = function() {
   if(this.config.map.currentLat)
      return this.config.map.currentLat
   else if(this.config.map.latMin)
      return (this.config.map.latMin + this.config.map.latMax)/2;
   else if(this.config.map.latitude)
      return this.config.map.latitude;
   else
      return Maperial.DEFAULT_LATITUDE;
}

MapView.prototype.startLongitude = function() {
   if(this.config.map.currentLon)
      return this.config.map.currentLon
   else if(this.config.map.lonMin)
      return (this.config.map.lonMin + this.config.map.lonMax)/2;
   else if(this.config.map.longitude)
      return this.config.map.longitude;
   else
      return Maperial.DEFAULT_LONGITUDE;
}

MapView.prototype.startZoom = function() {
   
   if(this.config.map.currentZoom)
      return this.config.map.currentZoom
   else if(this.config.map.defaultZoom)
      return this.config.map.defaultZoom;
   else
      return Maperial.DEFAULT_ZOOM;
}

//==================================================================//

MapView.prototype.loadStyles = function(next){

   console.log("checking styles...");
   var styleUIDs = [];

   for(var i = 0; i < this.config.layers.length; i++){
      var layerParams = this.config.layers[i].params;
      if(layerParams.styles){
         styleUIDs.push(layerParams.styles[layerParams.selectedStyle]);

         if(this.layersManager.firstOSMPosition < 0)
            this.layersManager.firstOSMPosition = i;
      }
   }

   if(styleUIDs.length > 0){
      this.stylesManager.fetchStyles(styleUIDs, next);
   }
   else 
      next();
}

//==================================================================//

/**
 * a revoir completement pour une gestion multi styles.
 * ici on recupere le dernier layerOSM pour le refresh = pas possible d'avoir plusieurs layers OSM avec ce fonctionnement
 */
MapView.prototype.changeStyle = function(styleUID, position, refresh){

   if(position === undefined) position = 0;
   if(refresh === undefined) refresh = true;
   
   // ici c'est foireux : ca ne permet pas proprement un multi layerCreation sur plusieurs mapView.
   // ca bugguera si on ouvre une edition, puis une 2e sur la 2e view avant de finir la premiere.
   var layerToRefresh = this.maperial.layersCreation.currentLayerIndex
   
   var layerParams = this.config.layers[layerToRefresh].params;
   if(!layerParams.styles || refresh){

      if(refresh)
         console.log("Changing style...");
      else
         console.log("  using default style...");

      layerParams.styles = {};
      layerParams.styles[position] = styleUID;
      layerParams.selectedStyle = position;
   }

   if(refresh){
      var me = this
      this.stylesManager.loadStyle(styleUID, function(){
         var mapLatLon = me.context.coordS.MetersToLatLon(me.context.centerM.x, me.context.centerM.y)
         
         me.config.map.currentLat    = mapLatLon.y
         me.config.map.currentLon    = mapLatLon.x
         me.config.map.currentZoom   = me.context.zoom
         
         me.refreshOSMVisibilities()
         $(window).trigger(MaperialEvents.STYLE_CHANGED, [me.name, layerToRefresh]);
      })
   }
}

//==================================================================//

MapView.prototype.loadColorbars = function(next){

   console.log("checking colorbars...");
   var colorbarUIDs = [];

   for(var i = 0; i < this.config.layers.length; i++){
      var layerParams = this.config.layers[i].params;
      if(layerParams.colorbars){
         colorbarUIDs.push(layerParams.colorbars[layerParams.selectedColorbar]);
      }
   }

   if(colorbarUIDs.length > 0){
      this.colorbarsManager.fetchColorbars(colorbarUIDs, next);
   }
   else 
      next();
}

//==================================================================//

MapView.prototype.checkOSMSets = function(){

   if(this.stylesManager.styleCacheEmpty())
      return;

   console.log("checking OSM sets...");

   var selectedStyle = this.stylesManager.getSelectedStyle();

   if(selectedStyle && !this.config.map.osmSets){
      this.layersManager.defaultOSMSets(selectedStyle);
   }

   this.refreshOSMVisibilities();
}

MapView.prototype.refreshOSMVisibilities = function(){
   this.context.osmVisibilities = LayersManager.buildOSMVisibilities(this.config.map.osmSets);
}

//==================================================================//

MapView.prototype.buildAll = function() {

   console.log("build all elements...");

   //--------------------------//

   this.buildMap();
   this.buildHUD();

   if(this.config.map.edition)
      this.buildStyleMenu();

   if(!this.colorbarsManager.colorbarCacheEmpty()){
      this.buildColorbar();
   }

   //--------------------------//
   
   if(this.requireGeoloc())
      this.initGeoloc();

   //--------------------------//
   
   if(this.config.useLeaflet){
      this.refreshScreen()      
      this.buildLeafletLayer();
   }
   
   //--------------------------//

   this.finishStartup();
}

//==================================================================//

MapView.prototype.buildLeafletLayer = function() {

   console.log("Adding Leaflet...")
   
   var latitude   = this.startLatitude()
   var longitude  = this.startLongitude()
   var zoom       = this.startZoom()

   //-----------------------------------------------------------//

   var leafletLayer = L.map('MapLeaflet_'+this.name, {
      dragging : this.type == Maperial.MAIN,
      zoomControl : this.type == Maperial.MAIN,
      attributionControl : false,
   }).setView([latitude, longitude], zoom);

//   if(this.type == Maperial.MAIN){
      L.marker([51.5, -0.09]).addTo(leafletLayer)
      .bindPopup("<b>Grreat!</b><br />GG Maperial").openPopup();
//   }

   L.circle([51.508, -0.11], 500, {
      color: 'red',
      fillColor: '#f03',
      fillOpacity: 0.5
   }).addTo(leafletLayer).bindPopup("I am a circle.");

   L.polygon([
      [51.509, -0.08],
      [51.503, -0.06],
      [51.51, -0.047]
   ]).addTo(leafletLayer).bindPopup("I am a polygon.");

   //-----------------------------------------------------------//


   var heatmapLayer = L.TileLayer.heatMap({
      // radius could be absolute or relative
      // absolute: radius in meters, relative: radius in pixels
      radius: { value: 40000, absolute: true },
//      radius: { value: 60, absolute: false },
      opacity: 0.8,
      gradient: {
         0.45: "rgb(0,0,255)",
         0.55: "rgb(0,255,255)",
         0.65: "rgb(0,255,0)",
         0.95: "yellow",
         1.0: "rgb(255,0,0)"
      }
   });

   heatmapLayer.setData(MapView.testData.data);
   
   heatmapLayer.addTo(leafletLayer);

   //-----------------------------------------------------------//
   
   var popup = L.popup();

   function onMapClick(e) {
      popup
         .setLatLng(e.latlng)
         .setContent("You clicked the map at " + e.latlng.toString())
         .openOn(leafletLayer);
   }

   var mapView = this
   function onMapMove(e) {
      var center = leafletLayer.getCenter()
      mapView.SetCenter (center.lat, center.lng)
      $(window).trigger(MaperialEvents.MAP_MOVING, [mapView.map, mapView.name, mapView.type]);
   }

   function onMapZom(e) {
      mapView.SetZoom (leafletLayer.getZoom())
   }

   if(this.type == Maperial.MAIN){
      leafletLayer.on('click', onMapClick);
      leafletLayer.on('move',  onMapMove);
   }
   
   leafletLayer.on('zoomend',  onMapZom);
   
   this.context.leaflet = leafletLayer
   console.log("  Leaflet ready")
}
   
//==================================================================//
   
MapView.prototype.finishStartup = function() {
   this.refreshScreen();
   console.log("MapView is ready")
   $(window).trigger(MaperialEvents.VIEW_READY, [this.name])
}

//==================================================================//

MapView.prototype.buildMap = function() {

   console.log("  building map...");

   this.mapRenderer = new MapRenderer( this );
   this.mapMover = new MapMover( this );
   this.mapMouse = new MapMouse( this );
   this.mapRenderer.Start();

   if(this.config.map.requireBoundingBoxDrawer){
      
      this.boundingBoxDrawer = new BoundingBoxDrawer(this);
      
      if(this.config.map.boundingBoxStartLat){
         this.boundingBoxDrawer.centerLat = this.config.map.boundingBoxStartLat;
         this.boundingBoxDrawer.centerLon = this.config.map.boundingBoxStartLon;
         this.SetCenter(this.boundingBoxDrawer.centerLat, this.boundingBoxDrawer.centerLon);
      }
   }
   
   //------------------------//
   
   var me = this
   var panel = $("#panel"+this.name)

   if(this.options.draggable){
      var me = this
      panel.draggable({ 
         snap           : false, 
         containment    : "#TheMaperial",
         scroll         : false,   
         start: function(event) {
            if(me.type == Maperial.LENS)
               me.moveChildInterval = setInterval( function(){ me.refreshCamera() } , 0.01 );
         },
         stop: function(event) {
            clearInterval(me.moveChildInterval);
            me.moveChildInterval = null
         }
      });
   }
      
}

//==================================================================//

MapView.prototype.requireGeoloc = function() {
   return this.config.hud.elements[HUD.GEOLOC] && (this.config.hud.elements[HUD.GEOLOC].show || this.config.hud.elements[HUD.SETTINGS]);
}

MapView.prototype.initGeoloc = function() {
   this.geoloc = new GeoLoc(this, "GeoLoc_"+this.name, $("#GeoLocGo_"+this.name), false);
}

//==================================================================//

MapView.prototype.buildStyleMenu = function() {
   this.styleMenu = new StyleMenu($("#DetailsMenu_"+this.name) , $("#QuickEdit_"+this.name) , $("#Zooms_"+this.name) , this);
}

//==================================================================//

MapView.prototype.buildColorbar = function() {
   this.colorbar = new Colorbar(
         $("#ColorBar_"+this.name),
         this.colorbarsManager.getColorbar(Maperial.DEFAULT_COLORBAR_UID),
         50,355,50,40,true,25.4,375.89
   );
   
   this.mapRenderer.renderAllColorBars();
}

//==================================================================//

MapView.prototype.buildHUD = function() {
   this.hud.build();
}

//==================================================================//

MapView.prototype.setCanvasSize = function() {

   var w = this.width;
   var h = this.height;
   
   if(this.context.mapCanvas[0]){
      this.context.mapCanvas.css("width", w);
      this.context.mapCanvas.css("height", h);
      this.context.mapCanvas[0].width = w;
      this.context.mapCanvas[0].height = h;
   }
   
   if(this.context.mapLeaflet[0]){
      this.context.mapLeaflet.css("position", "absolute");
      this.context.mapLeaflet.css("left", "0px");
      this.context.mapLeaflet.css("top", "0px");
      this.context.mapLeaflet.css("background", "rgba(0,0,0,0)");
      this.context.mapLeaflet.css("width", w);
      this.context.mapLeaflet.css("height", h);
      this.context.mapLeaflet[0].width = w;
      this.context.mapLeaflet[0].height = h;
   }
}

MapView.prototype.refreshScreen = function() {
   console.log(" refreshing screen...")
   
   $('body').css('overflow', 'hidden');
   if(typeof this.options.width == "string"){
      var parentWidth   = this.parent ? this.parent.width : $("#TheMaperial").width()
      var widthParams   = this.options.width.split("%")
      if(widthParams.length > 1)
         this.width = widthParams[0] * parentWidth/100
      else
         this.width = this.options.width
   }
   else
      this.width = $("#TheMaperial").width()

   if(typeof this.options.height == "string"){
      var parentHeight   = this.parent ? this.parent.height : $("#TheMaperial").height()
      var heightParams   = this.options.height.split("%")
      if(heightParams.length > 1)
         this.height = heightParams[0] * parentHeight/100
      else
         this.height = this.options.height
   }
   else
      this.height = $("#TheMaperial").height()
      
   this.setCanvasSize()
      
   $('body').css('overflow', 'hidden');
   this.context.mapCanvas.css("position", "relative");
   $('body').css("position", "relative");
   
   try{
      this.mapRenderer.fitToSize();
   }
   catch(e){
      console.log("------------> fito size pb")
      console.log(e)
   }

   try{
      this.hud.placeElements();
      this.mapMover.resizeDrawers();
   }
   catch(e){
      console.log("------------> placing pb")
      console.log(e)
   }

   if(this.type != Maperial.MAIN){
      this.hud.placeMapView()
      this.refreshCamera()
   }

   this.hud.styleView()

   $('body').css('overflow', 'auto');
}

//==================================================================//

MapView.prototype.refreshCurrentLatLon = function(){
   var mapLatLon = this.context.coordS.MetersToLatLon(this.context.centerM.x, this.context.centerM.y)
   this.config.map.currentLat   = mapLatLon.y
   this.config.map.currentLon   = mapLatLon.x
   this.config.map.currentZoom  = this.context.zoom
}

//==================================================================//

MapView.prototype.centerMap = function(lat, lon, zoom, type){

   switch(type){
      case "prepare" : 
         this.prepareCenter(lat, lon, zoom)
         break;
      case "place" : 
         this.placeMap(lat, lon, zoom)
         break;
   }  
}

/**
 * Prepare the config being created to put the map at given x.y.z
 */
MapView.prototype.prepareCenter = function(lat, lon, zoom){
   this.config.map.currentLat   = lat
   this.config.map.currentLon   = lon
   this.config.map.currentZoom  = zoom
}

/**
 * Immediately put the map at given x.y.z
 */
MapView.prototype.placeMap = function(lat, lon, zoom){
   this.SetCenter (lat, lon)
   this.SetZoom   (zoom)
}

//==================================================================//

MapView.prototype.SetCenter = function(lat,lon){
   this.context.centerM = this.context.coordS.LatLonToMeters( lat , lon );
   this.refreshCurrentLatLon();
   //this.mapRenderer.DrawScene();
}

MapView.prototype.SetZoom = function(z){
   if ( z > -1 && z < 19 ){
      this.context.zoom = z;
   }
}

MapView.prototype.GetZoom = function(){
   return this.context.zoom;
}

MapView.prototype.ZoomIn = function(){
   if ( this.context.zoom < 18 ){
      this.SetZoom(this.context.zoom + 1 );
   }
}

MapView.prototype.ZoomOut = function(){
   if ( this.context.zoom > 0 ){
      this.SetZoom(this.context.zoom - 1 );
   }
}

//==================================================================//

MapView.prototype.showBoundingBox = function(boundingBox){
   this.boundingBoxDrawer.init(boundingBox);
   $("#drawBoardContainer"+this.name).removeClass("hide");
}

MapView.prototype.hideBoundingBox = function(){
   $("#drawBoardContainer"+this.name).addClass("hide");
}

MapView.prototype.deactivateBoundingBoxDrawing = function(){
   this.boundingBoxDrawer.deactivateDrawing();
}

MapView.prototype.activateBoundingBoxDrawing = function(){
   this.boundingBoxDrawer.activateDrawing();
}

//==================================================================//

MapView.prototype.getFullName = function(childName){
   return childName + "_" + this.name
}

//==================================================================//

/**
 * type = "prepare" or "place"
 */
MapView.prototype.centerWMS = function (src, type) {
   
   switch(src){
      // US - only
      case Source.IMAGES_STAMEN_TERRAIN : 
         this.centerMap(40.68, -74.12, 7, type)
         break;

         // Bretagne
      case Source.WMS_BRETAGNECANTONS : 
         this.centerMap(48.27, -2.87, 9, type)
         break;

         // Rennes
      case Source.WMS_SOLS_ILEETVILAINE : 
         this.centerMap(48.11, -1.78, 10, type)
         break;
   }   
}

//==================================================================//

MapView.prototype.refreshZoom = function (typeTriggering, zoom) {
   
   switch(this.type){
      case Maperial.MAIN : 
      case Maperial.ANCHOR :

         switch(typeTriggering){
            case Maperial.MAIN : 
            case Maperial.ANCHOR :
               this.context.zoom = zoom;
               break;

            case Maperial.MINIFIER : 
            case Maperial.MAGNIFIER : 
            case Maperial.LENS :
               break;
         }

         break;

      case Maperial.MINIFIER : 
      case Maperial.MAGNIFIER : 
      case Maperial.LENS :

         switch(typeTriggering){
            case Maperial.MAIN : 
            case Maperial.ANCHOR :
               this.context.zoom = zoom + this.deltaZoom;
               break;

            case Maperial.MINIFIER : 
            case Maperial.MAGNIFIER : 
            case Maperial.LENS :
               break;
         }
         break;
   }

}

//==================================================================//

MapView.prototype.refreshLeafletView = function () {
   this.context.leaflet.setView([this.config.map.currentLat, this.config.map.currentLon], this.config.map.currentZoom, {pan: {animate: false}});
}

MapView.prototype.refreshCamera = function (viewTriggering, typeTriggering, zoom) {

   if(!viewTriggering)
      viewTriggering = this.maperial.getMainView(this.map).name

   if(!typeTriggering)
      typeTriggering = Maperial.MAIN

   if(!zoom)
      zoom = this.maperial.getZoom(this.map)

   this.refreshZoom(typeTriggering, zoom);
   
   switch(this.type){
      case Maperial.MINIFIER : 
         this.context.centerM = this.maperial.getMainView(this.map).context.centerM
         break;

      case Maperial.MAGNIFIER : 
         this.context.centerM = this.maperial.getView(viewTriggering).context.mouseM
         break;

      case Maperial.MAIN : 
      case Maperial.LENS :
      case Maperial.ANCHOR :
         
         if(this.type == Maperial.MAIN && typeTriggering != Maperial.ANCHOR)
            return
            
         var panel = $("#panel"+this.name)
         var panelTriggering = $("#panel"+viewTriggering)

         var panelTriggeringPosition = panelTriggering.position();
         var viewPosition = panel.position();
         
         var viewCenterX = viewPosition.left + panel.width()/2
         var viewCenterY = viewPosition.top + panel.height()/2

         var panelTriggeringCenterX = panelTriggeringPosition.left + panelTriggering.width()/2
         var panelTriggeringCenterY = panelTriggeringPosition.top + panelTriggering.height()/2
         
         var viewTriggeringCenterP = this.maperial.getCenterP(viewTriggering)
         var lensCenterP = new Point( viewTriggeringCenterP.x - panelTriggeringCenterX + viewCenterX , viewTriggeringCenterP.y + panelTriggeringCenterY - viewCenterY);

         this.context.centerM = this.context.coordS.PixelsToMeters ( lensCenterP.x, lensCenterP.y, this.maperial.getZoom(this.map) );
//         this.mapRenderer.DrawScene()
         
         break;
   }
   
   this.refreshCurrentLatLon()
   
   if(this.type != Maperial.MAIN && this.context.leaflet){
      this.refreshLeafletView()
   }
}

//-------------------------------------------------//

MapView.testData={
      max: 46,
      data: [{lat: 33.5363, lon:-117.044, value: 1},{lat: 33.5608, lon:-117.24, value: 1},{lat: 38, lon:-97, value: 1},{lat: 38.9358, lon:-77.1621, value: 1},{lat: 38, lon:-97, value: 2},{lat: 54, lon:-2, value: 1},{lat: 51.5167, lon:-0.7, value: 2},{lat: 51.5167, lon:-0.7, value: 6},{lat: 60.3911, lon:5.3247, value: 1},{lat: 50.8333, lon:12.9167, value: 9},{lat: 50.8333, lon:12.9167, value: 1},{lat: 52.0833, lon:4.3, value: 3},{lat: 52.0833, lon:4.3, value: 1},{lat: 51.8, lon:4.4667, value: 16},{lat: 51.8, lon:4.4667, value: 9},{lat: 51.8, lon:4.4667, value: 2},{lat: 51.1, lon:6.95, value: 1},{lat: 13.75, lon:100.517, value: 1},{lat: 18.975, lon:72.8258, value: 1},{lat: 2.5, lon:112.5, value: 2},{lat: 25.0389, lon:102.718, value: 1},{lat: -27.6167, lon:152.733, value: 1},{lat: -33.7667, lon:150.833, value: 1},{lat: -33.8833, lon:151.217, value: 2},{lat: 9.4333, lon:99.9667, value: 1},{lat: 33.7, lon:73.1667, value: 1},{lat: 33.7, lon:73.1667, value: 2},{lat: 22.3333, lon:114.2, value: 1},{lat: 37.4382, lon:-84.051, value: 1},{lat: 34.6667, lon:135.5, value: 1},{lat: 37.9167, lon:139.05, value: 1},{lat: 36.3214, lon:127.42, value: 1},{lat: -33.8, lon:151.283, value: 2},{lat: -33.8667, lon:151.225, value: 1},{lat: -37.65, lon:144.933, value: 2},{lat: -37.7333, lon:145.267, value: 1},{lat: -34.95, lon:138.6, value: 1},{lat: -27.5, lon:153.017, value: 1},{lat: -27.5833, lon:152.867, value: 3},{lat: -35.2833, lon:138.55, value: 1},{lat: 13.4443, lon:144.786, value: 2},{lat: -37.8833, lon:145.167, value: 1},{lat: -37.86, lon:144.972, value: 1},{lat: -27.5, lon:153.05, value: 1},{lat: 35.685, lon:139.751, value: 2},{lat: -34.4333, lon:150.883, value: 2},{lat: 14.0167, lon:100.733, value: 2},{lat: 13.75, lon:100.517, value: 5},{lat: -31.9333, lon:115.833, value: 1},{lat: -33.8167, lon:151.167, value: 1},{lat: -37.9667, lon:145.117, value: 1},{lat: -37.8333, lon:145.033, value: 1},{lat: -37.6417, lon:176.186, value: 2},{lat: -37.6861, lon:176.167, value: 1},{lat: -41.2167, lon:174.917, value: 1},{lat: 39.0521, lon:-77.015, value: 3},{lat: 24.8667, lon:67.05, value: 1},{lat: 24.9869, lon:121.306, value: 1},{lat: 53.2, lon:-105.75, value: 4},{lat: 44.65, lon:-63.6, value: 1},{lat: 53.9667, lon:-1.0833, value: 1},{lat: 40.7, lon:14.9833, value: 1},{lat: 37.5331, lon:-122.247, value: 1},{lat: 39.6597, lon:-86.8663, value: 2},{lat: 33.0247, lon:-83.2296, value: 1},{lat: 34.2038, lon:-80.9955, value: 1},{lat: 28.0087, lon:-82.7454, value: 1},{lat: 44.6741, lon:-93.4103, value: 1},{lat: 31.4507, lon:-97.1909, value: 1},{lat: 45.61, lon:-73.84, value: 1},{lat: 49.25, lon:-122.95, value: 1},{lat: 49.9, lon:-119.483, value: 2},{lat: 32.7825, lon:-96.8207, value: 6},{lat: 32.7825, lon:-96.8207, value: 7},{lat: 32.7825, lon:-96.8207, value: 4},{lat: 32.7825, lon:-96.8207, value: 41},{lat: 32.7825, lon:-96.8207, value: 11},{lat: 32.7825, lon:-96.8207, value: 3},{lat: 32.7825, lon:-96.8207, value: 10},{lat: 32.7825, lon:-96.8207, value: 5},{lat: 32.7825, lon:-96.8207, value: 14},{lat: 41.4201, lon:-75.6485, value: 4},{lat: 31.1999, lon:-92.3508, value: 1},{lat: 41.9874, lon:-91.6838, value: 1},{lat: 30.1955, lon:-85.6377, value: 1},{lat: 42.4266, lon:-92.358, value: 1},{lat: 41.6559, lon:-91.5228, value: 1},{lat: 33.9269, lon:-117.861, value: 3},{lat: 41.8825, lon:-87.6441, value: 6},{lat: 42.3998, lon:-88.8271, value: 1},{lat: 33.1464, lon:-97.0902, value: 1},{lat: 47.2432, lon:-93.5119, value: 1},{lat: 41.6472, lon:-93.46, value: 1},{lat: 36.1213, lon:-76.6414, value: 1},{lat: 41.649, lon:-93.6275, value: 1},{lat: 44.8547, lon:-93.7854, value: 1},{lat: 43.6833, lon:-79.7667, value: 1},{lat: 40.6955, lon:-89.4293, value: 1},{lat: 37.6211, lon:-77.6515, value: 1},{lat: 37.6273, lon:-77.5437, value: 3},{lat: 33.9457, lon:-118.039, value: 1},{lat: 33.8408, lon:-118.079, value: 1},{lat: 40.3933, lon:-74.7855, value: 1},{lat: 40.9233, lon:-73.9984, value: 1},{lat: 39.0735, lon:-76.5654, value: 1},{lat: 40.5966, lon:-74.0775, value: 1},{lat: 40.2944, lon:-73.9932, value: 2},{lat: 38.9827, lon:-77.004, value: 1},{lat: 38.3633, lon:-81.8089, value: 1},{lat: 36.0755, lon:-79.0741, value: 1},{lat: 51.0833, lon:-114.083, value: 2},{lat: 49.1364, lon:-122.821, value: 1},{lat: 39.425, lon:-84.4982, value: 3},{lat: 38.7915, lon:-82.9217, value: 1},{lat: 39.0131, lon:-84.2049, value: 1},{lat: 29.7523, lon:-95.367, value: 7},{lat: 29.7523, lon:-95.367, value: 4},{lat: 41.5171, lon:-71.2789, value: 1},{lat: 29.7523, lon:-95.367, value: 2},{lat: 32.8148, lon:-96.8705, value: 1},{lat: 45.5, lon:-73.5833, value: 1},{lat: 40.7529, lon:-73.9761, value: 6},{lat: 33.6534, lon:-112.246, value: 1},{lat: 40.7421, lon:-74.0018, value: 1},{lat: 38.3928, lon:-121.368, value: 1},{lat: 32.7825, lon:-96.8207, value: 1},{lat: 39.7968, lon:-76.993, value: 2},{lat: 40.5607, lon:-111.724, value: 1},{lat: 41.2863, lon:-75.8953, value: 1},{lat: 26.3484, lon:-80.2187, value: 1},{lat: 32.711, lon:-117.053, value: 2},{lat: 32.5814, lon:-83.6286, value: 3},{lat: 35.0508, lon:-80.8186, value: 3},{lat: 35.0508, lon:-80.8186, value: 1},{lat: -22.2667, lon:166.45, value: 5},{lat: 50.1167, lon:8.6833, value: 1},{lat: 51.9167, lon:4.5, value: 2},{lat: 54, lon:-2, value: 6},{lat: 52.25, lon:21, value: 1},{lat: 49.1, lon:10.75, value: 3},{lat: 51.65, lon:6.1833, value: 1},{lat: 1.3667, lon:103.8, value: 1},{lat: 29.4889, lon:-98.3987, value: 11},{lat: 29.3884, lon:-98.5311, value: 1},{lat: 41.8825, lon:-87.6441, value: 2},{lat: 41.8825, lon:-87.6441, value: 1},{lat: 33.9203, lon:-84.618, value: 4},{lat: 40.1242, lon:-82.3828, value: 1},{lat: 40.1241, lon:-82.3828, value: 1},{lat: 43.0434, lon:-87.8945, value: 1},{lat: 43.7371, lon:-74.3419, value: 1},{lat: 42.3626, lon:-71.0843, value: 1},{lat: 4.6, lon:-74.0833, value: 1},{lat: 19.7, lon:-101.117, value: 1},{lat: 25.6667, lon:-100.317, value: 1},{lat: 53.8167, lon:10.3833, value: 1},{lat: 50.8667, lon:6.8667, value: 3},{lat: 55.7167, lon:12.45, value: 2},{lat: 44.4333, lon:26.1, value: 4},{lat: 50.1167, lon:8.6833, value: 2},{lat: 52.5, lon:5.75, value: 4},{lat: 48.8833, lon:8.7, value: 1},{lat: 17.05, lon:-96.7167, value: 3},{lat: 23, lon:-102, value: 1},{lat: 20.6167, lon:-105.25, value: 1},{lat: 23, lon:-102, value: 2},{lat: 20.6667, lon:-103.333, value: 1},{lat: 21.1167, lon:-101.667, value: 1},{lat: 17.9833, lon:-92.9167, value: 1},{lat: 20.9667, lon:-89.6167, value: 2},{lat: 21.1667, lon:-86.8333, value: 1},{lat: 17.9833, lon:-94.5167, value: 1},{lat: 18.6, lon:-98.85, value: 1},{lat: 16.75, lon:-93.1167, value: 1},{lat: 19.4342, lon:-99.1386, value: 1},{lat: -10, lon:-55, value: 1},{lat: -22.9, lon:-43.2333, value: 1},{lat: 15.7833, lon:-86.8, value: 1},{lat: 10.4667, lon:-64.1667, value: 1},{lat: 7.1297, lon:-73.1258, value: 1},{lat: 4, lon:-72, value: 2},{lat: 4, lon:-72, value: 1},{lat: 6.8, lon:-58.1667, value: 1},{lat: 0, lon:0, value: 1},{lat: 48.15, lon:11.5833, value: 2},{lat: 45.8, lon:16, value: 15},{lat: 59.9167, lon:10.75, value: 1},{lat: 51.5002, lon:-0.1262, value: 1},{lat: 55, lon:73.4, value: 1},{lat: 52.5, lon:5.75, value: 1},{lat: 52.2, lon:0.1167, value: 1},{lat: 48.8833, lon:8.3333, value: 1},{lat: -33.9167, lon:18.4167, value: 1},{lat: 40.9157, lon:-81.133, value: 2},{lat: 43.8667, lon:-79.4333, value: 1},{lat: 54, lon:-2, value: 2},{lat: 39, lon:22, value: 1},{lat: 54, lon:-2, value: 11},{lat: 54, lon:-2, value: 4},{lat: 54, lon:-2, value: 3},{lat: 9.0833, lon:-79.3833, value: 2},{lat: 21.5, lon:-104.9, value: 1},{lat: 19.5333, lon:-96.9167, value: 1},{lat: 32.5333, lon:-117.017, value: 1},{lat: 19.4342, lon:-99.1386, value: 3},{lat: 18.15, lon:-94.4167, value: 1},{lat: 20.7167, lon:-103.4, value: 1},{lat: 23.2167, lon:-106.417, value: 2},{lat: 10.9639, lon:-74.7964, value: 1},{lat: 24.8667, lon:67.05, value: 2},{lat: 1.2931, lon:103.856, value: 1},{lat: -41, lon:174, value: 1},{lat: 13.75, lon:100.517, value: 2},{lat: 13.75, lon:100.517, value: 46},{lat: 13.75, lon:100.517, value: 9},{lat: 13.75, lon:100.517, value: 8},{lat: 13.75, lon:100.517, value: 7},{lat: 13.75, lon:100.517, value: 16},{lat: 13.75, lon:100.517, value: 4},{lat: 13.75, lon:100.517, value: 6},{lat: 55.75, lon:-97.8667, value: 5},{lat: 34.0438, lon:-118.251, value: 2},{lat: 44.2997, lon:-70.3698, value: 1},{lat: 46.9402, lon:-113.85, value: 14},{lat: 45.6167, lon:-61.9667, value: 1},{lat: 45.3833, lon:-66, value: 2},{lat: 54.9167, lon:-98.6333, value: 1},{lat: 40.8393, lon:-73.2797, value: 1},{lat: 41.6929, lon:-111.815, value: 1},{lat: 49.8833, lon:-97.1667, value: 1},{lat: 32.5576, lon:-81.9395, value: 1},{lat: 49.9667, lon:-98.3, value: 2},{lat: 40.0842, lon:-82.9378, value: 2},{lat: 49.25, lon:-123.133, value: 5},{lat: 35.2268, lon:-78.9561, value: 1},{lat: 43.9817, lon:-121.272, value: 1},{lat: 43.9647, lon:-121.341, value: 1},{lat: 32.7825, lon:-96.8207, value: 13},{lat: 33.4357, lon:-111.917, value: 2},{lat: 36.0707, lon:-97.9077, value: 1},{lat: 32.7791, lon:-96.8028, value: 1},{lat: 34.053, lon:-118.264, value: 1},{lat: 30.726, lon:-95.55, value: 1},{lat: 45.4508, lon:-93.5855, value: 1},{lat: 32.7825, lon:-96.8207, value: 8},{lat: 36.8463, lon:-76.0979, value: 3},{lat: 36.8463, lon:-76.0979, value: 1},{lat: 34.0533, lon:-118.255, value: 1},{lat: 35.7217, lon:-81.3603, value: 1},{lat: 40.6888, lon:-74.0203, value: 4},{lat: 47.5036, lon:-94.685, value: 2},{lat: 32.3304, lon:-81.6011, value: 1},{lat: 39.0165, lon:-77.5062, value: 2},{lat: 38.6312, lon:-90.1922, value: 1},{lat: 32.445, lon:-81.7758, value: 1},{lat: -37.9667, lon:145.15, value: 1},{lat: -33.9833, lon:151.117, value: 1},{lat: 49.6769, lon:6.1239, value: 2},{lat: 53.8167, lon:-1.2167, value: 1},{lat: 52.4667, lon:-1.9167, value: 3},{lat: 52.5, lon:5.75, value: 2},{lat: 33.5717, lon:-117.729, value: 4},{lat: 31.5551, lon:-97.1604, value: 1},{lat: 42.2865, lon:-71.7147, value: 1},{lat: 48.4, lon:-89.2333, value: 1},{lat: 42.9864, lon:-78.7279, value: 1},{lat: 41.8471, lon:-87.6248, value: 1},{lat: 34.5139, lon:-114.293, value: 1},{lat: 51.9167, lon:4.4, value: 1},{lat: 51.9167, lon:4.4, value: 4},{lat: 51.55, lon:5.1167, value: 38},{lat: 51.8, lon:4.4667, value: 8},{lat: 54.5, lon:-3.6167, value: 1},{lat: -34.9333, lon:138.6, value: 1},{lat: -33.95, lon:151.133, value: 1},{lat: 15, lon:100, value: 4},{lat: 15, lon:100, value: 1},{lat: 15, lon:100, value: 3},{lat: 15, lon:100, value: 2},{lat: 41.5381, lon:-87.6842, value: 1},{lat: 40.9588, lon:-75.3006, value: 1},{lat: 46.7921, lon:-96.8827, value: 1},{lat: 41.9474, lon:-87.7037, value: 1},{lat: 41.6162, lon:-87.0489, value: 1},{lat: 37.5023, lon:-77.5693, value: 1},{lat: 38.4336, lon:-77.3887, value: 1},{lat: 41.759, lon:-88.2615, value: 1},{lat: 42.0158, lon:-87.8423, value: 1},{lat: 46.5833, lon:-81.2, value: 1},{lat: 45.3667, lon:-63.3, value: 1},{lat: 18.0239, lon:-66.6366, value: 2},{lat: 43.2667, lon:-79.9333, value: 1},{lat: 45.0667, lon:-64.5, value: 1},{lat: 39.6351, lon:-78.7665, value: 1},{lat: 33.4483, lon:-81.6921, value: 2},{lat: 41.5583, lon:-87.6612, value: 1},{lat: 30.5315, lon:-90.4628, value: 1},{lat: 34.7664, lon:-82.2202, value: 2},{lat: 47.6779, lon:-117.379, value: 2},{lat: 47.6201, lon:-122.141, value: 1},{lat: 45.0901, lon:-87.7101, value: 1},{lat: 38.3119, lon:-90.1535, value: 3},{lat: 34.7681, lon:-84.9569, value: 4},{lat: 47.4061, lon:-121.995, value: 1},{lat: 40.6009, lon:-73.9397, value: 1},{lat: 40.6278, lon:-73.365, value: 1},{lat: 40.61, lon:-73.9108, value: 1},{lat: 34.3776, lon:-83.7605, value: 2},{lat: 38.7031, lon:-94.4737, value: 1},{lat: 39.3031, lon:-82.0828, value: 1},{lat: 42.5746, lon:-88.3946, value: 1},{lat: 45.4804, lon:-122.836, value: 1},{lat: 44.5577, lon:-123.298, value: 1},{lat: 40.1574, lon:-76.7978, value: 1},{lat: 34.8983, lon:-120.382, value: 1},{lat: 40.018, lon:-89.8623, value: 1},{lat: 37.3637, lon:-79.9549, value: 1},{lat: 37.2141, lon:-80.0625, value: 1},{lat: 37.2655, lon:-79.923, value: 1},{lat: 39.0613, lon:-95.7293, value: 1},{lat: 41.2314, lon:-80.7567, value: 1},{lat: 40.3377, lon:-79.8428, value: 1},{lat: 42.0796, lon:-71.0382, value: 1},{lat: 43.25, lon:-79.8333, value: 1},{lat: 40.7948, lon:-72.8797, value: 2},{lat: 40.6766, lon:-73.7038, value: 4},{lat: 37.979, lon:-121.788, value: 1},{lat: 43.1669, lon:-76.0558, value: 1},{lat: 37.5353, lon:-121.979, value: 1},{lat: 43.2345, lon:-71.5227, value: 1},{lat: 42.6179, lon:-70.7154, value: 3},{lat: 42.0765, lon:-71.472, value: 2},{lat: 35.2298, lon:-81.2428, value: 1},{lat: 39.961, lon:-104.817, value: 1},{lat: 44.6667, lon:-63.5667, value: 1},{lat: 38.4473, lon:-104.632, value: 3},{lat: 40.7148, lon:-73.7939, value: 1},{lat: 40.6763, lon:-73.7752, value: 1},{lat: 41.3846, lon:-73.0943, value: 2},{lat: 43.1871, lon:-70.91, value: 1},{lat: 33.3758, lon:-84.4657, value: 1},{lat: 15, lon:100, value: 12},{lat: 36.8924, lon:-80.076, value: 2},{lat: 25, lon:17, value: 1},{lat: 27, lon:30, value: 1},{lat: 49.1, lon:10.75, value: 2},{lat: 49.1, lon:10.75, value: 4},{lat: 47.6727, lon:-122.187, value: 1},{lat: -27.6167, lon:152.767, value: 1},{lat: -33.8833, lon:151.217, value: 1},{lat: 31.5497, lon:74.3436, value: 4},{lat: 13.65, lon:100.267, value: 2},{lat: -37.8167, lon:144.967, value: 1},{lat: 47.85, lon:12.1333, value: 3},{lat: 47, lon:8, value: 3},{lat: 52.1667, lon:10.55, value: 1},{lat: 50.8667, lon:6.8667, value: 2},{lat: 40.8333, lon:14.25, value: 2},{lat: 47.5304, lon:-122.008, value: 1},{lat: 47.5304, lon:-122.008, value: 3},{lat: 34.0119, lon:-118.468, value: 1},{lat: 38.9734, lon:-119.908, value: 1},{lat: 52.1333, lon:-106.667, value: 1},{lat: 41.4201, lon:-75.6485, value: 3},{lat: 45.6393, lon:-94.2237, value: 1},{lat: 33.7516, lon:-84.3915, value: 1},{lat: 26.0098, lon:-80.2592, value: 1},{lat: 34.5714, lon:-78.7566, value: 1},{lat: 40.7235, lon:-73.8612, value: 1},{lat: 39.1637, lon:-94.5215, value: 5},{lat: 28.0573, lon:-81.5687, value: 2},{lat: 26.8498, lon:-80.14, value: 1},{lat: 47.6027, lon:-122.156, value: 11},{lat: 47.6027, lon:-122.156, value: 1},{lat: 25.7541, lon:-80.271, value: 1},{lat: 32.7597, lon:-97.147, value: 1},{lat: 40.9083, lon:-73.8346, value: 2},{lat: 47.6573, lon:-111.381, value: 1},{lat: 32.3729, lon:-81.8443, value: 1},{lat: 32.7825, lon:-96.8207, value: 2},{lat: 41.5074, lon:-81.6053, value: 1},{lat: 32.4954, lon:-86.5, value: 1},{lat: 30.3043, lon:-81.7306, value: 1},{lat: 45.9667, lon:-81.9333, value: 1},{lat: 42.2903, lon:-72.6404, value: 5},{lat: 40.7553, lon:-73.9924, value: 1},{lat: 55.1667, lon:-118.8, value: 1},{lat: 37.8113, lon:-122.301, value: 1},{lat: 40.2968, lon:-111.676, value: 1},{lat: 42.0643, lon:-87.9921, value: 1},{lat: 42.3908, lon:-71.0925, value: 1},{lat: 44.2935, lon:-94.7601, value: 1},{lat: 40.4619, lon:-74.3561, value: 2},{lat: 32.738, lon:-96.4463, value: 1},{lat: 35.7821, lon:-78.8177, value: 1},{lat: 40.7449, lon:-73.9782, value: 1},{lat: 40.7449, lon:-73.9782, value: 2},{lat: 28.5445, lon:-81.3706, value: 1},{lat: 41.4201, lon:-75.6485, value: 1},{lat: 38.6075, lon:-83.7928, value: 1},{lat: 42.2061, lon:-83.206, value: 1},{lat: 42.3222, lon:-88.4671, value: 1},{lat: 42.3222, lon:-88.4671, value: 3},{lat: 37.7035, lon:-122.148, value: 1},{lat: 37.5147, lon:-122.042, value: 1},{lat: 40.6053, lon:-111.988, value: 1},{lat: 38.5145, lon:-81.7814, value: 1},{lat: 42.1287, lon:-88.2654, value: 1},{lat: 36.9127, lon:-120.196, value: 1},{lat: 36.3769, lon:-119.184, value: 1},{lat: 36.84, lon:-119.828, value: 1},{lat: 48.0585, lon:-122.148, value: 1},{lat: 42.1197, lon:-87.8445, value: 1},{lat: 40.7002, lon:-111.943, value: 2},{lat: 37.5488, lon:-122.312, value: 1},{lat: 41.3807, lon:-73.3915, value: 1},{lat: 45.5, lon:-73.5833, value: 3},{lat: 34.0115, lon:-117.854, value: 3},{lat: 43.0738, lon:-83.8608, value: 11},{lat: 33.9944, lon:-118.464, value: 3},{lat: 42.7257, lon:-84.636, value: 1},{lat: 32.7825, lon:-96.8207, value: 22},{lat: 40.7805, lon:-73.9512, value: 1},{lat: 42.1794, lon:-75.9491, value: 1},{lat: 43.3453, lon:-75.1285, value: 1},{lat: 42.195, lon:-83.165, value: 1},{lat: 33.9289, lon:-116.488, value: 5},{lat: 29.4717, lon:-98.514, value: 1},{lat: 28.6653, lon:-81.4188, value: 1},{lat: 40.8217, lon:-74.1574, value: 1},{lat: 41.2094, lon:-73.2116, value: 2},{lat: 41.0917, lon:-73.4316, value: 1},{lat: 30.4564, lon:-97.6938, value: 1},{lat: 36.1352, lon:-95.9364, value: 1},{lat: 33.3202, lon:-111.761, value: 1},{lat: 38.9841, lon:-77.3827, value: 1},{lat: 29.1654, lon:-82.0967, value: 1},{lat: 37.691, lon:-97.3292, value: 1},{lat: 33.5222, lon:-112.084, value: 1},{lat: 41.9701, lon:-71.7217, value: 1},{lat: 35.6165, lon:-97.4789, value: 3},{lat: 35.4715, lon:-97.519, value: 1},{lat: 41.2307, lon:-96.1178, value: 1},{lat: 53.55, lon:-113.5, value: 2},{lat: 36.0844, lon:-79.8209, value: 1},{lat: 40.5865, lon:-74.1497, value: 1},{lat: 41.9389, lon:-73.9901, value: 1},{lat: 40.8596, lon:-73.9314, value: 1},{lat: 33.6119, lon:-111.891, value: 2},{lat: 38.8021, lon:-90.627, value: 1},{lat: 38.8289, lon:-91.9744, value: 1},{lat: 42.8526, lon:-86.1263, value: 2},{lat: 40.781, lon:-73.2522, value: 1},{lat: 41.1181, lon:-74.0833, value: 2},{lat: 40.8533, lon:-74.6522, value: 2},{lat: 41.3246, lon:-73.6976, value: 1},{lat: 40.9796, lon:-73.7231, value: 1},{lat: 28.4517, lon:-81.4653, value: 1},{lat: 36.0328, lon:-115.025, value: 2},{lat: 32.5814, lon:-83.6286, value: 1},{lat: 33.6117, lon:-117.549, value: 1},{lat: 40.4619, lon:-74.3561, value: 4},{lat: 40.4619, lon:-74.3561, value: 1},{lat: 44.1747, lon:-94.0492, value: 3},{lat: 43.0522, lon:-87.965, value: 1},{lat: 40.0688, lon:-74.5956, value: 2},{lat: 33.6053, lon:-117.717, value: 1},{lat: 39.95, lon:-74.9929, value: 1},{lat: 38.678, lon:-77.3197, value: 2},{lat: 34.9184, lon:-92.1362, value: 2},{lat: 35.9298, lon:-86.4605, value: 1},{lat: 35.8896, lon:-86.3166, value: 1},{lat: 39.1252, lon:-76.5116, value: 1},{lat: 26.976, lon:-82.1391, value: 1},{lat: 34.5022, lon:-120.129, value: 1},{lat: 39.9571, lon:-76.7055, value: 2},{lat: 34.7018, lon:-86.6108, value: 1},{lat: 54.1297, lon:-108.435, value: 1},{lat: 32.805, lon:-116.902, value: 1},{lat: 45.6, lon:-73.7333, value: 1},{lat: 32.8405, lon:-116.88, value: 1},{lat: 33.2007, lon:-117.226, value: 1},{lat: 40.1246, lon:-75.5385, value: 1},{lat: 40.2605, lon:-75.6155, value: 1},{lat: 40.7912, lon:-77.8746, value: 1},{lat: 40.168, lon:-76.6094, value: 1},{lat: 40.3039, lon:-74.0703, value: 2},{lat: 39.3914, lon:-74.5182, value: 1},{lat: 40.1442, lon:-74.8483, value: 1},{lat: 28.312, lon:-81.589, value: 1},{lat: 34.0416, lon:-118.299, value: 1},{lat: 50.45, lon:-104.617, value: 1},{lat: 41.2305, lon:-73.1257, value: 3},{lat: 40.6538, lon:-73.6082, value: 1},{lat: 40.9513, lon:-73.8773, value: 2},{lat: 41.078, lon:-74.1764, value: 1},{lat: 32.7492, lon:-97.2205, value: 1},{lat: 39.5407, lon:-84.2212, value: 1},{lat: 40.7136, lon:-82.8012, value: 3},{lat: 36.2652, lon:-82.834, value: 8},{lat: 40.2955, lon:-75.3254, value: 2},{lat: 29.7755, lon:-95.4152, value: 2},{lat: 32.7791, lon:-96.8028, value: 3},{lat: 32.7791, lon:-96.8028, value: 2},{lat: 36.4642, lon:-87.3797, value: 2},{lat: 41.6005, lon:-72.8764, value: 1},{lat: 35.708, lon:-97.5749, value: 1},{lat: 40.8399, lon:-73.9422, value: 1},{lat: 41.9223, lon:-87.7555, value: 1},{lat: 42.9156, lon:-85.8464, value: 1},{lat: 41.8824, lon:-87.6376, value: 1},{lat: 30.6586, lon:-88.3535, value: 1},{lat: 42.6619, lon:-82.9211, value: 1},{lat: 35.0481, lon:-85.2833, value: 1},{lat: 32.3938, lon:-92.2329, value: 1},{lat: 39.402, lon:-76.6329, value: 1},{lat: 39.9968, lon:-75.1485, value: 1},{lat: 38.8518, lon:-94.7786, value: 1},{lat: 33.4357, lon:-111.917, value: 1},{lat: 35.8278, lon:-78.6421, value: 2},{lat: 22.3167, lon:114.183, value: 12},{lat: 34.0438, lon:-118.251, value: 1},{lat: 41.724, lon:-88.1127, value: 1},{lat: 37.4429, lon:-122.151, value: 1},{lat: 51.25, lon:-80.6, value: 1},{lat: 39.209, lon:-94.7305, value: 1},{lat: 40.7214, lon:-74.0052, value: 1},{lat: 33.92, lon:-117.208, value: 1},{lat: 29.926, lon:-97.5644, value: 1},{lat: 30.4, lon:-97.7528, value: 1},{lat: 26.937, lon:-80.135, value: 1},{lat: 32.8345, lon:-111.731, value: 1},{lat: 29.6694, lon:-82.3572, value: 13},{lat: 36.2729, lon:-115.133, value: 1},{lat: 33.2819, lon:-111.88, value: 3},{lat: 32.5694, lon:-117.016, value: 1},{lat: 38.8381, lon:-77.2121, value: 1},{lat: 41.6856, lon:-72.7312, value: 1},{lat: 33.2581, lon:-116.982, value: 1},{lat: 38.6385, lon:-90.3026, value: 1},{lat: 43.15, lon:-79.5, value: 2},{lat: 43.85, lon:-79.0167, value: 1},{lat: 44.8833, lon:-76.2333, value: 1},{lat: 45.4833, lon:-75.65, value: 1},{lat: 53.2, lon:-105.75, value: 1},{lat: 51.0833, lon:-114.083, value: 1},{lat: 29.7523, lon:-95.367, value: 1},{lat: 38.692, lon:-92.2929, value: 1},{lat: 34.1362, lon:-117.298, value: 2},{lat: 28.2337, lon:-82.179, value: 1},{lat: 40.9521, lon:-73.7382, value: 1},{lat: 38.9186, lon:-76.7862, value: 2},{lat: 42.2647, lon:-71.8089, value: 1},{lat: 42.6706, lon:-73.7791, value: 1},{lat: 39.5925, lon:-78.5901, value: 1},{lat: 52.1333, lon:-106.667, value: 2},{lat: 40.2964, lon:-75.2053, value: 1},{lat: 34.1066, lon:-117.815, value: 1},{lat: 40.8294, lon:-73.5052, value: 1},{lat: 42.1298, lon:-72.5687, value: 1},{lat: 25.6615, lon:-80.412, value: 2},{lat: 37.8983, lon:-122.049, value: 1},{lat: 37.0101, lon:-122.032, value: 2},{lat: 40.2843, lon:-76.8446, value: 1},{lat: 39.4036, lon:-104.56, value: 1},{lat: 34.8397, lon:-106.688, value: 1},{lat: 40.1879, lon:-75.4254, value: 2},{lat: 35.0212, lon:-85.2729, value: 2},{lat: 40.214, lon:-75.073, value: 1},{lat: 39.9407, lon:-75.2281, value: 1},{lat: 47.2098, lon:-122.409, value: 1},{lat: 41.3433, lon:-73.0654, value: 2},{lat: 41.7814, lon:-72.7544, value: 1},{lat: 41.3094, lon:-72.924, value: 1},{lat: 45.3218, lon:-122.523, value: 1},{lat: 45.4104, lon:-122.702, value: 3},{lat: 45.6741, lon:-122.471, value: 2},{lat: 32.9342, lon:-97.2515, value: 1},{lat: 40.8775, lon:-74.1105, value: 1},{lat: 40.82, lon:-96.6806, value: 1},{lat: 45.5184, lon:-122.655, value: 1},{lat: 41.0544, lon:-74.6171, value: 1},{lat: 35.3874, lon:-78.8686, value: 1},{lat: 39.961, lon:-85.9837, value: 1},{lat: 34.0918, lon:-84.2209, value: 2},{lat: 39.1492, lon:-78.278, value: 1},{lat: 38.7257, lon:-77.7982, value: 1},{lat: 45.0059, lon:-93.4305, value: 1},{lat: 35.0748, lon:-80.6774, value: 1},{lat: 35.8059, lon:-78.7997, value: 1},{lat: 35.8572, lon:-84.0177, value: 1},{lat: 38.7665, lon:-89.6533, value: 1},{lat: 43.7098, lon:-87.7478, value: 2},{lat: 33.3961, lon:-84.7821, value: 1},{lat: 32.7881, lon:-96.9431, value: 1},{lat: 43.1946, lon:-89.2025, value: 1},{lat: 43.0745, lon:-87.9078, value: 1},{lat: 34.0817, lon:-84.2553, value: 1},{lat: 37.9689, lon:-103.749, value: 1},{lat: 31.7969, lon:-106.387, value: 1},{lat: 31.7435, lon:-106.297, value: 1},{lat: 29.6569, lon:-98.5107, value: 1},{lat: 28.4837, lon:-82.5496, value: 1},{lat: 29.1137, lon:-81.0285, value: 1},{lat: 29.6195, lon:-100.809, value: 1},{lat: 35.4568, lon:-97.2652, value: 1},{lat: 33.8682, lon:-117.929, value: 1},{lat: 32.7977, lon:-117.132, value: 1},{lat: 33.3776, lon:-112.387, value: 1},{lat: 43.1031, lon:-79.0092, value: 1},{lat: 40.7731, lon:-80.1137, value: 2},{lat: 40.7082, lon:-74.0132, value: 1},{lat: 39.7187, lon:-75.6216, value: 1},{lat: 29.8729, lon:-98.014, value: 1},{lat: 42.5324, lon:-70.9737, value: 1},{lat: 41.6623, lon:-71.0107, value: 1},{lat: 41.1158, lon:-78.9098, value: 1},{lat: 39.2694, lon:-76.7447, value: 1},{lat: 39.9, lon:-75.3075, value: 1},{lat: 41.2137, lon:-85.0996, value: 1},{lat: 32.8148, lon:-96.8705, value: 2},{lat: 39.8041, lon:-75.4559, value: 4},{lat: 40.0684, lon:-75.0065, value: 1},{lat: 44.8791, lon:-68.733, value: 1},{lat: 40.1879, lon:-75.4254, value: 1},{lat: 41.8195, lon:-71.4107, value: 1},{lat: 38.9879, lon:-76.5454, value: 3},{lat: 42.5908, lon:-71.8055, value: 6},{lat: 40.7842, lon:-73.8422, value: 2},{lat: 0, lon:0, value: 2},{lat: 33.336, lon:-96.7491, value: 5},{lat: 33.336, lon:-96.7491, value: 6},{lat: 37.4192, lon:-122.057, value: 1},{lat: 33.7694, lon:-83.3897, value: 1},{lat: 37.7609, lon:-87.1513, value: 1},{lat: 33.8651, lon:-84.8948, value: 1},{lat: 28.5153, lon:-82.2856, value: 1},{lat: 35.1575, lon:-89.7646, value: 1},{lat: 32.318, lon:-95.2921, value: 1},{lat: 35.4479, lon:-91.9977, value: 1},{lat: 36.6696, lon:-93.2615, value: 1},{lat: 34.0946, lon:-101.683, value: 1},{lat: 31.9776, lon:-102.08, value: 1},{lat: 39.0335, lon:-77.4838, value: 1},{lat: 40.0548, lon:-75.4083, value: 8},{lat: 38.9604, lon:-94.8049, value: 2},{lat: 33.8138, lon:-117.799, value: 3},{lat: 33.8138, lon:-117.799, value: 1},{lat: 33.8138, lon:-117.799, value: 2},{lat: 38.2085, lon:-85.6918, value: 3},{lat: 37.7904, lon:-85.4848, value: 1},{lat: 42.4488, lon:-94.2254, value: 1},{lat: 43.179, lon:-77.555, value: 1},{lat: 29.7523, lon:-95.367, value: 3},{lat: 40.665, lon:-73.7502, value: 1},{lat: 40.6983, lon:-73.888, value: 1},{lat: 43.1693, lon:-77.6189, value: 1},{lat: 43.7516, lon:-70.2793, value: 1},{lat: 37.3501, lon:-121.985, value: 1},{lat: 32.7825, lon:-96.8207, value: 19},{lat: 35.1145, lon:-101.771, value: 1},{lat: 31.7038, lon:-83.6753, value: 2},{lat: 34.6222, lon:-83.7901, value: 1},{lat: 35.7102, lon:-84.3743, value: 1},{lat: 42.0707, lon:-72.044, value: 1},{lat: 34.7776, lon:-82.3051, value: 2},{lat: 34.9965, lon:-82.3287, value: 1},{lat: 32.5329, lon:-85.5078, value: 1},{lat: 41.5468, lon:-93.6209, value: 1},{lat: 41.2587, lon:-80.8298, value: 1},{lat: 35.2062, lon:-81.1384, value: 1},{lat: 39.9741, lon:-86.1272, value: 1},{lat: 33.7976, lon:-118.162, value: 1},{lat: 41.8675, lon:-87.6744, value: 1},{lat: 42.8526, lon:-86.1263, value: 1},{lat: 39.9968, lon:-82.9882, value: 1},{lat: 35.1108, lon:-89.9483, value: 1},{lat: 35.1359, lon:-90.0027, value: 1},{lat: 32.3654, lon:-90.1118, value: 1},{lat: 42.1663, lon:-71.3611, value: 1},{lat: 39.5076, lon:-104.677, value: 2},{lat: 39.378, lon:-104.858, value: 1},{lat: 44.84, lon:-93.0365, value: 1},{lat: 31.2002, lon:-97.9921, value: 1},{lat: 26.1783, lon:-81.7145, value: 2},{lat: 47.9469, lon:-122.197, value: 1},{lat: 32.2366, lon:-90.1688, value: 1},{lat: 25.7341, lon:-80.3594, value: 13},{lat: 26.9467, lon:-80.217, value: 2},{lat: 44.9487, lon:-93.1002, value: 1},{lat: 38.6485, lon:-77.3108, value: 1},{lat: 45.6676, lon:-122.606, value: 1},{lat: 40.1435, lon:-75.3567, value: 1},{lat: 43.0139, lon:-71.4352, value: 1},{lat: 41.9395, lon:-71.2943, value: 2},{lat: 37.6134, lon:-77.2564, value: 1},{lat: 42.5626, lon:-83.6099, value: 1},{lat: 41.55, lon:-88.1248, value: 1},{lat: 34.0311, lon:-118.49, value: 1},{lat: 33.7352, lon:-118.315, value: 1},{lat: 34.0872, lon:-117.882, value: 1},{lat: 33.8161, lon:-117.979, value: 2},{lat: 47.6609, lon:-116.834, value: 15},{lat: 40.2594, lon:-81.9641, value: 2},{lat: 35.9925, lon:-78.9017, value: 1},{lat: 32.8098, lon:-96.7993, value: 5},{lat: 32.6988, lon:-97.1237, value: 1},{lat: 32.9722, lon:-96.7376, value: 3},{lat: 32.9513, lon:-96.7154, value: 1},{lat: 32.9716, lon:-96.7058, value: 2},{lat: 41.4796, lon:-81.511, value: 2},{lat: 36.7695, lon:-119.795, value: 1},{lat: 36.2082, lon:-86.879, value: 2},{lat: 41.3846, lon:-73.0943, value: 1},{lat: 37.795, lon:-122.219, value: 1},{lat: 41.4231, lon:-73.4771, value: 1},{lat: 38.0322, lon:-78.4873, value: 1},{lat: 43.6667, lon:-79.4167, value: 1},{lat: 42.3222, lon:-88.4671, value: 7},{lat: 40.7336, lon:-96.6394, value: 2},{lat: 33.7401, lon:-117.82, value: 2},{lat: 33.7621, lon:-84.3982, value: 1},{lat: 39.7796, lon:-75.0505, value: 1},{lat: 39.4553, lon:-74.9608, value: 1},{lat: 39.7351, lon:-75.6684, value: 1},{lat: 51.3833, lon:0.5167, value: 1},{lat: 45.9833, lon:6.05, value: 1},{lat: 51.1833, lon:14.4333, value: 1},{lat: 41.9167, lon:8.7333, value: 1},{lat: 45.4, lon:5.45, value: 2},{lat: 51.9, lon:6.1167, value: 1},{lat: 50.4333, lon:30.5167, value: 1},{lat: 24.6408, lon:46.7728, value: 1},{lat: 54.9878, lon:-1.4214, value: 5},{lat: 51.45, lon:-2.5833, value: 2},{lat: 46, lon:2, value: 2},{lat: 51.5167, lon:-0.7, value: 1},{lat: 35.94, lon:14.3533, value: 1},{lat: 53.55, lon:10, value: 1},{lat: 53.6, lon:7.2, value: 1},{lat: 53.8333, lon:-1.7667, value: 1},{lat: 53.7833, lon:-1.75, value: 2},{lat: 52.6333, lon:-1.1333, value: 1},{lat: 53.5333, lon:-1.1167, value: 2},{lat: 51.0167, lon:-0.45, value: 2},{lat: 50.7833, lon:-0.65, value: 1},{lat: 50.9, lon:-1.4, value: 1},{lat: 50.9, lon:-1.4, value: 5},{lat: 52.2, lon:-2.2, value: 8},{lat: 50.1167, lon:8.6833, value: 3},{lat: 49.0047, lon:8.3858, value: 1},{lat: 49.1, lon:10.75, value: 7},{lat: 37.9833, lon:23.7333, value: 1},{lat: 41.9, lon:12.4833, value: 19},{lat: 51.8833, lon:10.5667, value: 3},{lat: 50.0333, lon:12.0167, value: 1},{lat: 49.8667, lon:10.8333, value: 14},{lat: 51, lon:9, value: 1},{lat: 53.3667, lon:-1.5, value: 1},{lat: 52.9333, lon:-1.5, value: 1},{lat: 52.9667, lon:-1.1667, value: 1},{lat: 52.9667, lon:-1.3, value: 1},{lat: 51.9, lon:-2.0833, value: 2},{lat: 50.3, lon:3.9167, value: 1},{lat: 45.45, lon:-73.75, value: 4},{lat: 53.7, lon:-2.2833, value: 1},{lat: 53.9833, lon:-1.5333, value: 1},{lat: 50.8167, lon:7.1667, value: 1},{lat: 56.5, lon:-2.9667, value: 1},{lat: 51.4667, lon:-0.35, value: 1},{lat: 43.3667, lon:-5.8333, value: 1},{lat: 47, lon:8, value: 4},{lat: 47, lon:8, value: 1},{lat: 47, lon:8, value: 2},{lat: 50.7333, lon:-1.7667, value: 2},{lat: 52.35, lon:4.9167, value: 1},{lat: 48.8833, lon:8.3333, value: 2},{lat: 53.5333, lon:-0.05, value: 1},{lat: 55.95, lon:-3.2, value: 2},{lat: 55.8333, lon:-4.25, value: 4},{lat: 54.6861, lon:-1.2125, value: 2},{lat: 52.5833, lon:-0.25, value: 2},{lat: 53.55, lon:-2.5167, value: 2},{lat: 52.7667, lon:-1.2, value: 1},{lat: 52.6333, lon:-1.8333, value: 2},{lat: 55.0047, lon:-1.4728, value: 2},{lat: 50.9, lon:-1.4, value: 2},{lat: 52.6333, lon:1.3, value: 5},{lat: 52.25, lon:-1.1667, value: 1},{lat: 54.9167, lon:-1.7333, value: 1},{lat: 53.5667, lon:-2.9, value: 3},{lat: 55.8833, lon:-3.5333, value: 1},{lat: 53.0667, lon:6.4667, value: 1},{lat: 48.3333, lon:16.35, value: 37},{lat: 58.35, lon:15.2833, value: 1},{lat: 50.6167, lon:3.0167, value: 1},{lat: 53.3833, lon:-2.6, value: 1},{lat: 53.3833, lon:-2.6, value: 2},{lat: 54.5333, lon:-1.15, value: 5},{lat: 51.55, lon:0.05, value: 2},{lat: 51.55, lon:0.05, value: 1},{lat: 50.8, lon:-0.3667, value: 2},{lat: 49.0533, lon:11.7822, value: 1},{lat: 52.2333, lon:4.8333, value: 1},{lat: 54.5833, lon:-1.4167, value: 3},{lat: 54.5833, lon:-5.9333, value: 1},{lat: 43.1167, lon:5.9333, value: 2},{lat: 51.8333, lon:-2.25, value: 1},{lat: 50.3964, lon:-4.1386, value: 2},{lat: 51.45, lon:-2.5833, value: 4},{lat: 54.9881, lon:-1.6194, value: 1},{lat: 55.9833, lon:-4.6, value: 4},{lat: 53.4167, lon:-3, value: 1},{lat: 51.5002, lon:-0.1262, value: 2},{lat: 50.3964, lon:-4.1386, value: 8},{lat: 51.3742, lon:-2.1364, value: 1},{lat: 52.4833, lon:-2.1167, value: 1},{lat: 54.5728, lon:-1.1628, value: 1},{lat: 54.5333, lon:-1.15, value: 1},{lat: 47.7833, lon:7.3, value: 1},{lat: 46.95, lon:4.8333, value: 1},{lat: 60.1756, lon:24.9342, value: 2},{lat: 58.2, lon:16, value: 2},{lat: 57.7167, lon:11.9667, value: 1},{lat: 60.0667, lon:15.9333, value: 2},{lat: 41.2333, lon:1.8167, value: 2},{lat: 40.4833, lon:-3.3667, value: 1},{lat: 52.1333, lon:4.6667, value: 2},{lat: 51.4167, lon:5.4167, value: 1},{lat: 51.9667, lon:4.6167, value: 2},{lat: 51.8333, lon:4.6833, value: 1},{lat: 51.8333, lon:4.6833, value: 2},{lat: 48.2, lon:16.3667, value: 1},{lat: 54.6833, lon:25.3167, value: 2},{lat: 51.9333, lon:4.5833, value: 2},{lat: 50.9, lon:5.9833, value: 1},{lat: 51.4333, lon:-1, value: 1},{lat: 49.4478, lon:11.0683, value: 1},{lat: 61.1333, lon:21.5, value: 1},{lat: 62.4667, lon:6.15, value: 1},{lat: 59.2167, lon:10.95, value: 1},{lat: 48.8667, lon:2.3333, value: 1},{lat: 52.35, lon:4.9167, value: 4},{lat: 52.35, lon:4.9167, value: 5},{lat: 52.35, lon:4.9167, value: 32},{lat: 54.0833, lon:12.1333, value: 1},{lat: 50.8, lon:-0.5333, value: 1},{lat: 50.8333, lon:-0.15, value: 1},{lat: 52.5167, lon:13.4, value: 2},{lat: 58.3167, lon:15.1333, value: 2},{lat: 59.3667, lon:16.5, value: 1},{lat: 55.8667, lon:12.8333, value: 2},{lat: 50.8667, lon:6.8667, value: 1},{lat: 52.5833, lon:-0.25, value: 1},{lat: 53.5833, lon:-0.65, value: 2},{lat: 44.4333, lon:26.1, value: 6},{lat: 44.4333, lon:26.1, value: 3},{lat: 51.7833, lon:-3.0833, value: 1},{lat: 50.85, lon:-1.7833, value: 1},{lat: 52.2333, lon:-1.7333, value: 1},{lat: 53.1333, lon:-1.2, value: 2},{lat: 51.4069, lon:-2.5558, value: 1},{lat: 51.3833, lon:-0.1, value: 1},{lat: 52.4667, lon:-0.9167, value: 1},{lat: 55.1667, lon:-1.6833, value: 1},{lat: 50.9667, lon:-2.75, value: 5},{lat: 53.25, lon:-1.9167, value: 4},{lat: 55.8333, lon:-4.25, value: 5},{lat: 50.7167, lon:-2.4333, value: 1},{lat: 51.2, lon:-0.5667, value: 2},{lat: 51.0667, lon:-1.7833, value: 2},{lat: 51.8167, lon:-2.7167, value: 2},{lat: 53.3833, lon:-0.7667, value: 1},{lat: 51.3667, lon:1.45, value: 6},{lat: 55.4333, lon:-5.6333, value: 1},{lat: 52.4167, lon:-1.55, value: 4},{lat: 51.5333, lon:-0.3167, value: 2},{lat: 50.45, lon:-3.5, value: 2},{lat: 53.0167, lon:-1.6333, value: 1},{lat: 51.7833, lon:1.1667, value: 3},{lat: 53.8833, lon:-1.2667, value: 1},{lat: 56.6667, lon:-3, value: 2},{lat: 51.4, lon:-1.3167, value: 5},{lat: 52.1333, lon:-0.45, value: 1},{lat: 52.4667, lon:-1.9167, value: 1},{lat: 52.05, lon:-2.7167, value: 1},{lat: 54.7, lon:-5.8667, value: 2},{lat: 52.4167, lon:-1.55, value: 1},{lat: 43.6, lon:3.8833, value: 1},{lat: 49.1833, lon:-0.35, value: 1},{lat: 52.6333, lon:-1.1333, value: 2},{lat: 52.4733, lon:-8.1558, value: 1},{lat: 53.3331, lon:-6.2489, value: 3},{lat: 53.3331, lon:-6.2489, value: 1},{lat: 52.3342, lon:-6.4575, value: 1},{lat: 52.2583, lon:-7.1119, value: 1},{lat: 54.25, lon:-6.9667, value: 1},{lat: 52.9667, lon:-1.1667, value: 2},{lat: 51.3742, lon:-2.1364, value: 2},{lat: 52.5667, lon:-1.55, value: 3},{lat: 49.9481, lon:11.5783, value: 1},{lat: 52.3833, lon:9.9667, value: 1},{lat: 47.8167, lon:9.5, value: 1},{lat: 50.0833, lon:19.9167, value: 1},{lat: 52.2167, lon:5.2833, value: 1},{lat: 42.4333, lon:-8.6333, value: 1},{lat: 42.8333, lon:12.8333, value: 1},{lat: 55.7167, lon:12.45, value: 1},{lat: 50.7, lon:3.1667, value: 1},{lat: 51.5833, lon:-0.2833, value: 1},{lat: 53.4333, lon:-1.35, value: 1},{lat: 62.8, lon:30.15, value: 1},{lat: 51.3, lon:12.3333, value: 2},{lat: 53.6528, lon:-6.6814, value: 1},{lat: 40.2333, lon:-3.7667, value: 1},{lat: 42.3741, lon:-71.1072, value: 1},{lat: 51.5002, lon:-0.1262, value: 5},{lat: 52.4667, lon:-1.9167, value: 2},{lat: 53.5, lon:-2.2167, value: 3},{lat: 54.0667, lon:-2.8333, value: 1},{lat: 52.5, lon:-2, value: 1},{lat: 48.0833, lon:-1.6833, value: 2},{lat: 43.6, lon:1.4333, value: 4},{lat: 52.6, lon:-2, value: 1},{lat: 56, lon:-3.7667, value: 1},{lat: 55.8333, lon:-4.25, value: 3},{lat: 55.8333, lon:-4.25, value: 1},{lat: 55.8333, lon:-4.25, value: 2},{lat: 53.8, lon:-1.5833, value: 1},{lat: 54.65, lon:-2.7333, value: 1},{lat: 51.5, lon:-3.2, value: 1},{lat: 54.35, lon:-6.2833, value: 1},{lat: 51.2, lon:-0.8, value: 1},{lat: 54.6861, lon:-1.2125, value: 1},{lat: 51.75, lon:-0.3333, value: 2},{lat: 52.3667, lon:-1.25, value: 1},{lat: 53.8, lon:-1.5833, value: 2},{lat: 52.6333, lon:-2.5, value: 2},{lat: 52.5167, lon:-1.4667, value: 1},{lat: 57.4833, lon:12.0667, value: 1},{lat: 59.3667, lon:18.0167, value: 1},{lat: 46, lon:2, value: 1},{lat: 51.0211, lon:-3.1047, value: 1},{lat: 53.4167, lon:-3, value: 4},{lat: 51.25, lon:-0.7667, value: 1},{lat: 49, lon:2.3833, value: 1},{lat: 50.8333, lon:4, value: 1},{lat: 48.7833, lon:2.4667, value: 1},{lat: 52, lon:20, value: 2},{lat: 55.7522, lon:37.6156, value: 1},{lat: 51.55, lon:5.1167, value: 1},{lat: 52, lon:20, value: 1},{lat: 49.9667, lon:7.9, value: 1},{lat: 46.25, lon:20.1667, value: 1},{lat: 49.3, lon:-1.2333, value: 1},{lat: 48.4333, lon:8.6833, value: 1},{lat: 51.65, lon:-0.2667, value: 1},{lat: 53.7, lon:-1.4833, value: 2},{lat: 51.5002, lon:-0.1262, value: 3},{lat: 51.5, lon:-0.5833, value: 1},{lat: 52.5833, lon:-2.1333, value: 2},{lat: 49.2833, lon:1, value: 3},{lat: 43.65, lon:5.2667, value: 2},{lat: 54.9881, lon:-1.6194, value: 2},{lat: 51.3458, lon:-2.9678, value: 2},{lat: 51.0833, lon:-4.05, value: 1},{lat: 50.8667, lon:-2.9667, value: 1},{lat: 50.3964, lon:-4.1386, value: 5},{lat: 53.5333, lon:-1.1167, value: 1},{lat: 54.9878, lon:-1.4214, value: 3},{lat: 51.4167, lon:-0.2833, value: 1},{lat: 54.9881, lon:-1.6194, value: 3},{lat: 52.4167, lon:-1.55, value: 3},{lat: 51.5002, lon:-0.1262, value: 4},{lat: 51.55, lon:0.1667, value: 1},{lat: 51.8333, lon:-2.25, value: 3},{lat: 53.65, lon:-1.7833, value: 2},{lat: 53.5833, lon:-2.4333, value: 2},{lat: 51.45, lon:-2.5833, value: 1},{lat: 59.9667, lon:17.7, value: 1},{lat: 54, lon:-2, value: 8},{lat: 52.7167, lon:-2.7333, value: 2},{lat: 51.0833, lon:-0.7, value: 1},{lat: 51.8, lon:4.4667, value: 1},{lat: 48.9, lon:9.1167, value: 1},{lat: 48.3167, lon:2.5, value: 2},{lat: 51.6667, lon:-0.4, value: 1},{lat: 51.75, lon:-1.25, value: 1},{lat: 52.6333, lon:-2.5, value: 1},{lat: 52.35, lon:4.9167, value: 3},{lat: 51.3458, lon:-2.9678, value: 1},{lat: 53.7167, lon:-1.85, value: 1},{lat: 53.4333, lon:-1.35, value: 4},{lat: 42.2, lon:24.3333, value: 2},{lat: 51.5333, lon:0.7, value: 1},{lat: 50.3964, lon:-4.1386, value: 1},{lat: 50.3964, lon:-4.1386, value: 12},{lat: 50.3964, lon:-4.1386, value: 20},{lat: 52.5833, lon:-2.1333, value: 1},{lat: 55.7667, lon:-4.1667, value: 7},{lat: 53.3167, lon:-3.1, value: 1},{lat: 51.9, lon:-2.0833, value: 1},{lat: 50.7167, lon:-1.8833, value: 1},{lat: 51.6, lon:0.5167, value: 2},{lat: 53.5, lon:-2.2167, value: 1},{lat: 53.1333, lon:-1.2, value: 1},{lat: 52.0167, lon:4.3333, value: 4},{lat: 50.7, lon:3.1667, value: 2},{lat: 49.6769, lon:6.1239, value: 13},{lat: 53.1, lon:-2.4333, value: 1},{lat: 51.3794, lon:-2.3656, value: 1},{lat: 24.6408, lon:46.7728, value: 2},{lat: 24.6408, lon:46.7728, value: 3},{lat: 50.75, lon:-1.55, value: 1},{lat: 52.6333, lon:1.75, value: 1},{lat: 48.15, lon:9.4667, value: 1},{lat: 52.35, lon:4.9167, value: 2},{lat: 60.8, lon:11.1, value: 1},{lat: 43.561, lon:-116.214, value: 1},{lat: 47.5036, lon:-94.685, value: 1},{lat: 42.1818, lon:-71.1962, value: 1},{lat: 42.0477, lon:-74.1227, value: 1},{lat: 40.0326, lon:-75.719, value: 1},{lat: 40.7128, lon:-73.2962, value: 2},{lat: 27.9003, lon:-82.3024, value: 1},{lat: 38.2085, lon:-85.6918, value: 1},{lat: 46.8159, lon:-100.706, value: 1},{lat: 30.5449, lon:-90.8083, value: 1},{lat: 44.735, lon:-89.61, value: 1},{lat: 41.4201, lon:-75.6485, value: 2},{lat: 39.4209, lon:-74.4977, value: 1},{lat: 39.7437, lon:-104.979, value: 1},{lat: 39.5593, lon:-105.006, value: 1},{lat: 45.2673, lon:-93.0196, value: 1},{lat: 41.1215, lon:-89.4635, value: 1},{lat: 43.4314, lon:-83.9784, value: 1},{lat: 43.7279, lon:-86.284, value: 1},{lat: 40.7168, lon:-73.9861, value: 1},{lat: 47.7294, lon:-116.757, value: 1},{lat: 47.7294, lon:-116.757, value: 2},{lat: 35.5498, lon:-118.917, value: 1},{lat: 34.1568, lon:-118.523, value: 1},{lat: 39.501, lon:-87.3919, value: 3},{lat: 33.5586, lon:-112.095, value: 1},{lat: 38.757, lon:-77.1487, value: 1},{lat: 33.223, lon:-117.107, value: 1},{lat: 30.2316, lon:-85.502, value: 1},{lat: 39.1703, lon:-75.5456, value: 8},{lat: 30.0041, lon:-95.2984, value: 2},{lat: 29.7755, lon:-95.4152, value: 1},{lat: 41.8014, lon:-87.6005, value: 1},{lat: 37.8754, lon:-121.687, value: 7},{lat: 38.4493, lon:-122.709, value: 1},{lat: 40.5494, lon:-89.6252, value: 1},{lat: 42.6105, lon:-71.2306, value: 1},{lat: 40.0973, lon:-85.671, value: 1},{lat: 40.3987, lon:-86.8642, value: 1},{lat: 40.4224, lon:-86.8031, value: 4},{lat: 47.2166, lon:-122.451, value: 1},{lat: 32.2369, lon:-110.956, value: 1},{lat: 41.3969, lon:-87.3274, value: 2},{lat: 41.7364, lon:-89.7043, value: 2},{lat: 42.3425, lon:-71.0677, value: 1},{lat: 33.8042, lon:-83.8893, value: 1},{lat: 36.6859, lon:-121.629, value: 2},{lat: 41.0957, lon:-80.5052, value: 1},{lat: 46.8841, lon:-123.995, value: 1},{lat: 40.2851, lon:-75.9523, value: 2},{lat: 42.4235, lon:-85.3992, value: 1},{lat: 39.7437, lon:-104.979, value: 2},{lat: 25.6586, lon:-80.3568, value: 7},{lat: 33.0975, lon:-80.1753, value: 1},{lat: 25.7615, lon:-80.2939, value: 1},{lat: 26.3739, lon:-80.1468, value: 1},{lat: 37.6454, lon:-84.8171, value: 1},{lat: 34.2321, lon:-77.8835, value: 1},{lat: 34.6774, lon:-82.928, value: 1},{lat: 39.9744, lon:-86.0779, value: 1},{lat: 35.6784, lon:-97.4944, value: 2},{lat: 33.5547, lon:-84.1872, value: 1},{lat: 27.2498, lon:-80.3797, value: 1},{lat: 41.4789, lon:-81.6473, value: 1},{lat: 41.813, lon:-87.7134, value: 1},{lat: 41.8917, lon:-87.9359, value: 1},{lat: 35.0911, lon:-89.651, value: 1},{lat: 32.6102, lon:-117.03, value: 1},{lat: 41.758, lon:-72.7444, value: 1},{lat: 39.8062, lon:-86.1407, value: 1},{lat: 41.872, lon:-88.1662, value: 1},{lat: 34.1404, lon:-81.3369, value: 1},{lat: 46.15, lon:-60.1667, value: 1},{lat: 36.0679, lon:-86.7194, value: 1},{lat: 43.45, lon:-80.5, value: 1},{lat: 44.3833, lon:-79.7, value: 1},{lat: 45.4167, lon:-75.7, value: 2},{lat: 43.75, lon:-79.2, value: 2},{lat: 45.2667, lon:-66.0667, value: 3},{lat: 42.9833, lon:-81.25, value: 2},{lat: 44.25, lon:-79.4667, value: 3},{lat: 45.2667, lon:-66.0667, value: 2},{lat: 34.3667, lon:-118.478, value: 3},{lat: 42.734, lon:-87.8211, value: 1},{lat: 39.9738, lon:-86.1765, value: 1},{lat: 33.7438, lon:-117.866, value: 1},{lat: 37.5741, lon:-122.321, value: 1},{lat: 42.2843, lon:-85.2293, value: 1},{lat: 34.6574, lon:-92.5295, value: 1},{lat: 41.4881, lon:-87.4424, value: 1},{lat: 25.72, lon:-80.2707, value: 1},{lat: 34.5873, lon:-118.245, value: 1},{lat: 35.8278, lon:-78.6421, value: 1}]
  };
