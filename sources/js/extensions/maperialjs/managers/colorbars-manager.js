//-------------------------------------------//
//- ColorbarsManager - note: "ColorbarManager" exists as webapp.managers.colorbarManager...
//-------------------------------------------//

function ColorbarsManager(mapView){

   this.mapView = mapView;

   this.colorbarsToLoad = null;
   this.nextFunction = null;

   window.maperialColorbars = window.maperialColorbars || {};  // cache containing all previously loaded colorbars
}

//-------------------------------------------//

ColorbarsManager.prototype.colorbarCacheEmpty = function() {
   return $.isEmptyObject(window.maperialColorbars);   
}

//-------------------------------------------//

ColorbarsManager.prototype.getSelectedColorbar = function(layerIndex) {

   var layerParams = this.mapView.config.layers[layerIndex].params;
   if(layerParams.colorbars){
      var colorbarUID = layerParams.colorbars[layerParams.selectedColorbar];
      return window.maperialColorbars[colorbarUID];
   }

   return null;
}

ColorbarsManager.prototype.getColorbar = function(uid){
   return window.maperialColorbars[uid];
}

ColorbarsManager.prototype.allColorbars = function(){
   return window.maperialColorbars;
}

//-------------------------------------------//

ColorbarsManager.prototype.fetchColorbars = function(colorbarUIDs, next) {

   this.nextFunction = next;

   if(colorbarUIDs.length > 0){
      var colorbarUID = colorbarUIDs.shift();
      this.colorbarsToLoad = colorbarUIDs;
      this.loadColorbar(colorbarUID);
   }
   else{
      next();
   }
}

//-------------------//

ColorbarsManager.prototype.loadColorbar = function(colorbarUID) {

   var me = this;

   if(window.maperialColorbars[colorbarUID]){
      this.loadNextColorbar();
      return;
   }

   var colorbarURL = this.getURL(colorbarUID);
   console.log("  fetching : " + colorbarURL);

   $.ajax({  
      type: "GET",  
      url: colorbarURL,
      dataType: "json",
      success: function (json) {
         /*
         window.maperialColorbars[colorbarUID] = {
               uid : colorbarUID, 
               name: colorbarUID, 
               content:json, 
               data: me.convertJsonToData(json)
         };
         */
         var cb = new ColorBarData ( );
         cb.FromJson (json) 
         me.SetColorBar (colorbarUID,cb ) 
         me.loadNextColorbar();
      }
   });

}

//----------------------------//

ColorbarsManager.prototype.SetColorBar = function( cb  ) {
   window.maperialColorbars[cb.Uid()] = {
      uid      : cb.Uid(), 
      name     : cb.Uid(), 
      data     : cb
   };
   return cb.Uid();
}

//----------------------------//

ColorbarsManager.prototype.loadNextColorbar = function() {
   this.fetchColorbars(this.colorbarsToLoad, this.nextFunction);
}

//----------------------------//

ColorbarsManager.prototype.getURL = function(colorbarUID) {
   return Maperial.apiURL + "/api/colorbar/" + colorbarUID;
}

//----------------------------//
/*
ColorbarsManager.prototype.convertJsonToData = function(colorbarJson) {
   
   var data = [];   
   var previousStep = 0;
   for (var i in colorbarJson) {
      for ( var n = previousStep; n <= parseInt(i); n++) {
         data.push ( colorbarJson[i].r );
         data.push ( colorbarJson[i].g );
         data.push ( colorbarJson[i].b );
         data.push ( colorbarJson[i].a * 255 );
      }
      
      previousStep = n;
   }
   
   return new Uint8Array(data);
}
*/