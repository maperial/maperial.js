
//==================================================================//

function TemplateBuilder(){
   this.config = null;
   this.tagId = null;
   this.container = null;
}

//==================================================================//

TemplateBuilder.prototype.build = function(maperial){

   this.config = maperial.config;
   this.tagId = maperial.tagId;
   
   this.container = $("#"+this.tagId);
   this.container.empty();
   this.container.addClass("maperial-container");

   console.log("drawing template "+this.tagId+"...");
   
   this.buildMap();
   this.buildHUD();
   this.buildAttribution();
}

//==================================================================//

TemplateBuilder.prototype.buildMap = function(){
   
   var html = "";
   html += "<canvas id=\"Map"+this.tagId+"\" class=\"maperial-map\"></canvas>";
   html += "<canvas id=\"fakeCanvas\" class=\"hide\"></canvas>";
   
   if(this.config.map.requireBoundingBoxDrawer){
      html += "<div id=\"drawBoardContainer"+this.tagId+"\" class=\"hide\">";
      html += "   <canvas id=\"drawBoard"+this.tagId+"\"></canvas>";
      html += "</div>";
   }
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildHUD = function(){
   this.buildHUDSettings();
   this.buildSwitchImages();
   this.buildCompositions();
   this.buildLatLon();
   this.buildScale();
   this.buildMapKey();
   this.buildControls();
   this.buildGeoloc();
   this.buildDetailsMenu();
   this.buildQuickEdit();
   this.buildZooms();
   this.buildMagnifier();
   this.buildColorbar();
}

//==================================================================//

TemplateBuilder.prototype.buildAttribution = function(){
   
   var html = "";
   var maperialAttribution = this.config.layers.length > 1 ? "Fusion by <a class=\"link\" target=\"_blank\" href=\"http://www.maperial.com\">#Maperial</a>." : "";
   var tilesAttribution    = "";
   var dataAttribution     = false;
   
   html += "<p id=\"attribution\">"

   for(var i = 0; i < this.config.layers.length; i++){
      if(this.config.layers[i].source.type == Source.MaperialOSM){
         maperialAttribution = "Styled tiles and fusion by <a class=\"link\" target=\"_blank\" href=\"http://www.maperial.com\">#Maperial</a>."
         dataAttribution = true
      }
      else if(this.config.layers[i].source.type == Source.Images){
         switch(this.config.layers[i].source.params.src){
            case Source.IMAGES_MAPQUEST:
            case Source.IMAGES_MAPQUEST_SATELLITE:
               tilesAttribution += " Basemap tiles by <a class=\"link\" target=\"_blank\" href=\"http://www.mapquest.com\">MapQuest</a>."
               break;

            case Source.IMAGES_OSM:
               tilesAttribution += " Basemap tiles by <a class=\"link\" target=\"_blank\" href=\"http://openstreetmap.org\">© OpenStreetMap contributors</a>."
               break;

            case Source.IMAGES_OCM_CYCLE:
            case Source.IMAGES_OCM_TRANSPORT:
            case Source.IMAGES_OCM_LANDSCAPE:
               tilesAttribution += " Basemap tiles by <a class=\"link\" target=\"_blank\" href=\"www.thunderforest.com\">OpenCycleMap</a>."
               dataAttribution = true
               break;
               
            case Source.IMAGES_STAMEN_WATERCOLOR:
            case Source.IMAGES_STAMEN_TERRAIN:
            case Source.IMAGES_STAMEN_TONER:
            case Source.IMAGES_STAMEN_TONER_BG:
               tilesAttribution += " Basemap tiles by <a class=\"link\" target=\"_blank\" href=\"http://maps.stamen.com\">Stamen Design</a>."
               break;

         }
      }
   }
   
   
   html += maperialAttribution
   html += tilesAttribution
   
   if(dataAttribution)
      html += " Data by <a class=\"link\" target=\"_blank\" href=\"http://openstreetmap.org\">© OpenStreetMap contributors</a>."
         
   html += "</p>"

   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildHUDSettings = function(){

   var html = "";
   html += "<a class=\"trigger snapper triggerHUDSettings hide\" id=\"triggerHUDSettings"+this.tagId+"\" href=\"#\"><i id=\"iconHUDSettings"+this.tagId+"\" class=\"icon-cog icon-white\"></i></a>";
   html += "<div class=\"panel snapper panelHUDSettings hide\" id=\"panelHUDSettings"+this.tagId+"\" >";
   html += "    <div id=\"HUDSettings"+this.tagId+"\"></div>";
   html += "</div>";
      
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildSwitchImages = function(){

   var html = "";
   html += "<div class=\"panel panelSwitchImages snapper hide\" id=\"panelSwitchImages"+this.tagId+"\" >";
   html += "    <div id=\"SwitchImages"+this.tagId+"\">";
   html += "         <img id=\"imagesMapquest"+this.tagId+"\" class=\"sourceThumb touchable\" src=\"http://static.maperial.localhost/images/icons/layer.images.mapquest.png\"></img>";
   html += "         <img id=\"imagesMapquestSatellite"+this.tagId+"\" class=\"sourceThumb touchable\" src=\"http://static.maperial.localhost/images/icons/layer.images.mapquest.satellite.png\"></img>";
   html += "         <img id=\"imagesOSM"+this.tagId+"\" class=\"sourceThumb touchable\" src=\"http://static.maperial.localhost/images/icons/layer.images.osm.png\"></img>";
   html += "    </div>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildCompositions = function(){
   
   var html = "";
   html += "<div class=\"panel panelCompositions snapper hide\" id=\"panelCompositions"+this.tagId+"\" >";
   html += "    <div id=\"Compositions"+this.tagId+"\"></div>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildLatLon = function(){
   
   var html = "";
   html += "<div class=\"panel panelLatLon snapper hide\" id=\"panelLatLon"+this.tagId+"\"  >";
   html += "    <div id=\"LatLon"+this.tagId+"\" class=\"row-fluid latlon\">";
   html += "         <div id=\"latitude"+this.tagId+"\" class=\"span6\"></div>";
   html += "         <div id=\"longitude"+this.tagId+"\" class=\"span6\"></div>";
   html += "    </div>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildScale = function(){

   var html = "";
   html += "<div class=\"panel panelScale snapper hide\" id=\"panelScale"+this.tagId+"\" >";
   html += "    <div id=\"Scale"+this.tagId+"\" class=\"scale\">";
   html += "         <div id=\"metersContainer"+this.tagId+"\" class=\"scaleContainer\"></div>";
   html += "         <div id=\"milesContainer"+this.tagId+"\" class=\"scaleContainer\"></div>";
   html += "    </div>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildMapKey = function(){
   
   var html = "";
   html += "<div class=\"panel panelMapKey snapper hide\" id=\"panelMapKey"+this.tagId+"\" >";
   html += "    <div id=\"MapKey"+this.tagId+"\">";
   html += "         <img src=\"http://static.maperial.localhost/images/global/dummy.legend.png\"></div>";
   html += "    </div>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildControls = function(){
   
   var html = "";
   html += "<div class=\"panel panelControls snapper hide\" id=\"panelControls"+this.tagId+"\" >";
   html += "    <div id=\"control-up"+this.tagId+"\" title=\"Up\" class=\"control-up\"></div>";
   html += "    <div id=\"control-down"+this.tagId+"\" title=\"Down\" class=\"control-down\"></div>";
   html += "    <div id=\"control-left"+this.tagId+"\" title=\"Left\" class=\"control-left\"></div>";
   html += "    <div id=\"control-right"+this.tagId+"\" title=\"Right\" class=\"control-right\"></div>";
   html += "    <div id=\"control-zoom"+this.tagId+"\" class=\"control-zoom\"></div>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildGeoloc = function(){

   var html = "";
   html += "<div class=\"panel panelGeoloc snapper hide\" id=\"panelGeoloc"+this.tagId+"\" >";
   html += "   <div id=\"geoloc"+this.tagId+"\" class=\"row-fluid\">";
   html += "      <div class=\"span9\">";
   html += "         <input type=\"text\" id=\"GeoLoc"+this.tagId+"\" name=\"GeotLoc"+this.tagId+"\" class=\"inputGeoloc\">";
   html += "      </div>";
   html += "      <div class=\"span2 offset1\">";
   html += "         <div id=\"GeoLocGo"+this.tagId+"\" class=\"btn-small btn-primary\"><i class=\"icon-arrow-right icon-white\"></i></div>";
   html += "      </div>";
   html += "   </div>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildDetailsMenu = function(){
   
   var html = "";
   html += "<div class=\"panel panelDetailsMenu snapper hide\" id=\"panelDetailsMenu"+this.tagId+"\" >";
   html += "    <div id=\"DetailsMenu"+this.tagId+"\">";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildQuickEdit = function(){
   
   var html = "";
   html += "<div class=\"panel panelQuickEdit snapper hide\" id=\"panelQuickEdit"+this.tagId+"\" >";
   html += "    <div id=\"QuickEdit"+this.tagId+"\">";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildZooms = function(){
   
   var html = "";
   html += "<div class=\"panel panelZooms snapper hide\" id=\"panelZooms"+this.tagId+"\" >";
   html += "    <div id=\"Zooms"+this.tagId+"\">";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildMagnifier = function(){
   
   var html = "";
   html += "<div class=\"panel panelMagnifier snapper hide\" id=\"panelMagnifier"+this.tagId+"\" >";
   html += "    <canvas id=\"Magnifier"+this.tagId+"\" class=\"maperial-magnifier\" width=\"200\" height=\"200\"></canvas>";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//

TemplateBuilder.prototype.buildColorbar = function(){
   
   var html = "";
   html += "<div class=\"panel snapper hide\" id=\"panelColorBar"+this.tagId+"\" class=\"panelColorBar\">";
   html += "    <div id=\"ColorBar"+this.tagId+"\">";
   html += "</div>";
   
   this.container.append(html);
}

//==================================================================//
