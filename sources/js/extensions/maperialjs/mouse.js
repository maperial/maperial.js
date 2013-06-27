//==================================================================//

function MapMouse(mapView){

   console.log("  listening mouse...");
   
   this.mapView            = mapView;
   this.config             = mapView.config;
   this.context            = mapView.context;
   
   this.mouseDown          = false;
   this.lastWheelMillis    = new Date().getTime();

   this.initListeners();
}

//==================================================================//

MapMouse.prototype.initListeners = function () {

   var mouse = this;
   
   switch(this.mapView.type){

      case Maperial.MAIN:
      case Maperial.ANCHOR:
         this.context.mapCanvas
         .mousedown  ( Utils.apply ( this , "down" ))
         .mouseup    ( Utils.apply ( this , "up" ))
         .mouseleave ( Utils.apply ( this , "leave" ))
         .mousemove  ( Utils.apply ( this , "move" ))
         .dblclick   ( Utils.apply ( this , "doubleClick" ))
         .bind('mousewheel', Utils.apply ( this , "wheel"))   
         break;

      case Maperial.LENS:
      case Maperial.MINIFIER:
      case Maperial.MAGNIFIER:
         this.context.mapCanvas
         .dblclick   ( Utils.apply ( this , "doubleClick" ))
         .bind('mousewheel', Utils.apply ( this , "wheelOnChild"))   
         break;
   }

}

//----------------------------------------------------------------------//

MapMouse.prototype.removeListeners = function () {
   this.context.mapCanvas.off("mousedown");
   this.context.mapCanvas.off("mouseup");
   this.context.mapCanvas.off("mousemove");
   this.context.mapCanvas.off("mouseleave");
   this.context.mapCanvas.unbind('dblclick');  
   this.context.mapCanvas.unbind('mousewheel');  
}

//==================================================================//

MapMouse.prototype.down = function (event) {

   event.preventDefault();
   
   this.mouseDown = true;
   this.context.mapCanvas.trigger(MaperialEvents.MOUSE_DOWN);
}

MapMouse.prototype.leave = function (event) {
   if(this.mouseDown)
      this.up(event);
}

MapMouse.prototype.up = function (event) {
   this.context.mapCanvas.removeClass( 'movable' )
   this.mouseDown = false; 
   this.context.mapCanvas.trigger(MaperialEvents.MOUSE_UP);
}

MapMouse.prototype.move = function (event) {
   
   event.preventDefault();
   
   // refresh magnifier
   this.context.mouseP = Utils.getPoint(event);
   this.context.mouseM = this.convertCanvasPointToMeters ( this.context.mouseP );

   this.context.mapCanvas.trigger(MaperialEvents.MOUSE_MOVE);

   if (!this.mouseDown){
      this.context.mapCanvas.trigger(MaperialEvents.UPDATE_LATLON);
   }
   else{
      this.context.mapCanvas.addClass( 'movable' )
      $(window).trigger(MaperialEvents.DRAGGING_MAP, [this.mapView.name]);
   }
}

MapMouse.prototype.doubleClick = function (event) {
   
   if(!this.mapView.zoomable)
      return
      
   this.context.zoom = Math.min(18, this.context.zoom + 1);
   this.context.centerM = this.convertCanvasPointToMeters(this.context.mouseP);
   
   // refresh mouse
   this.context.mouseP = Utils.getPoint(event);
   this.context.mouseM = this.convertCanvasPointToMeters ( this.context.mouseP );

   this.mapView.refreshCurrentLatLon();
   $(window).trigger(MaperialEvents.ZOOM_TO_REFRESH, [this.mapView.map, this.mapView.name, this.mapView.type, this.context.zoom]);

}

//----------------------------------------------------------------------//

MapMouse.prototype.wheel = function (event, delta) {

   if(!this.mapView.zoomable)
      return
      
   event.preventDefault();
   
   if(this.hasJustWheeled())
      return;
   
   var previousZoom = this.context.zoom
   
   if (delta > 0) {
      this.context.zoom = Math.min(18, this.context.zoom + 1);
      this.context.centerM = this.convertCanvasPointToMeters(this.context.mouseP);
   }
   else if (delta < 0) {

      var centerP = this.context.coordS.MetersToPixels(this.context.centerM.x, this.context.centerM.y, this.context.zoom);
      var oldShiftP = new Point( this.context.mapCanvas.width()/2 - this.context.mouseP.x , this.context.mapCanvas.height()/2 - this.context.mouseP.y);

      this.context.zoom = Math.max(0, this.context.zoom - 1);

      var r = this.context.coordS.Resolution ( this.context.zoom );
      var newShiftM = new Point(oldShiftP.x * r, oldShiftP.y * r);
      this.context.centerM = new Point(this.context.mouseM.x + newShiftM.x, this.context.mouseM.y - newShiftM.y);
   }

   // refresh mouse
   this.context.mouseP = Utils.getPoint(event);
   this.context.mouseM = this.convertCanvasPointToMeters ( this.context.mouseP );

   this.mapView.refreshCurrentLatLon();
   $(window).trigger(MaperialEvents.ZOOM_TO_REFRESH, [this.mapView.map, this.mapView.name, this.mapView.type, this.context.zoom]);
}

MapMouse.prototype.wheelOnChild = function (event, delta) {

   if(!this.mapView.zoomable)
      return
      
   event.preventDefault();
   
   if(this.hasJustWheeled() || delta == 0)
      return;
   
   this.context.zoom = Math.min(18, this.context.zoom + 1 * delta/Math.abs(delta));
   
   // refresh mouse
   this.context.mouseP = Utils.getPoint(event);
   this.context.mouseM = this.convertCanvasPointToMeters ( this.context.mouseP );
   
   this.mapView.refreshCurrentLatLon();
   $(window).trigger(MaperialEvents.ZOOM_TO_REFRESH);
}

//----------------------------------------------------------------------//
// Utils

MapMouse.prototype.hasJustWheeled = function () {
   var hasJustWheeled = new Date().getTime() - this.lastWheelMillis < 300;
   this.lastWheelMillis = new Date().getTime();

   return hasJustWheeled;
}

/**
 * param  mouseP : Point with coordinates in pixels, in the Canvas coordinates system
 * return mouseM : Point with coordinates in meters, in the Meters coordinates system
 */
MapMouse.prototype.convertCanvasPointToMeters = function (canvasPoint) {

   var w = this.context.mapCanvas.width();
   var h = this.context.mapCanvas.height();

   var centerP = this.context.coordS.MetersToPixels(this.context.centerM.x, this.context.centerM.y, this.context.zoom);
   var shiftX = w/2 - canvasPoint.x;
   var shiftY = h/2 - canvasPoint.y;
   
   return this.context.coordS.PixelsToMeters(centerP.x - shiftX, centerP.y + shiftY, this.context.zoom);
}