
HUD.prototype.buildControls = function(){

   var me = this;
   
   this.element("control-zoom").slider({
      orientation: "vertical",
      range: "min",
      min: 1,
      max: 18,
      value: this.mapView.context.zoom,
      slide: function( event, ui ) {
         me.controlZoomCursor().html(ui.value);
      },
      change: function( event, ui ) {
         me.mapView.context.zoom = parseInt(ui.value);
         me.refreshZoom(true);
      }
    });
   
   this.element("control-up")    .click( function(){ me.mapView.context.mapCanvas.trigger(MaperialEvents.CONTROL_UP);     } );
   this.element("control-down")  .click( function(){ me.mapView.context.mapCanvas.trigger(MaperialEvents.CONTROL_DOWN);   } );
   this.element("control-left")  .click( function(){ me.mapView.context.mapCanvas.trigger(MaperialEvents.CONTROL_LEFT);   } );
   this.element("control-right") .click( function(){ me.mapView.context.mapCanvas.trigger(MaperialEvents.CONTROL_RIGHT);  } );
   
   Utils.buildSliderStyle(this.mapView.getFullName("control-zoom"));

   this.refreshZoom();
}