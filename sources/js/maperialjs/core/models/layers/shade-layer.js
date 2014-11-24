var utils = require('../../../../libs/utils.js'),
    _     = require('../../../../libs/lodash.js'),
    Composition = require('./composition.js'),
    Layer = require('../layer.js');

//---------------------------------------------------------------------------

/**
 * Add shade on your maps
 *
 * @constructor
 */
function ShadeLayer(options) {

    _.extend(this, new Layer());
    this.composition = new Composition(this);
    _.extend(this, this.composition.api);

    this.id          = utils.generateUID();
    this.type        = Layer.Shade;
    this.params      = this.default();
    this.mapView     = options.mapView;

    this.setAlphaBlend();
}

//---------------------------------------------------------------------------

ShadeLayer.prototype.default = function () {
    return {
        uLight: [50, 50, 70],
        scale: 50
    };
}

//---------------------------------------------------------------------------

/**
 * Change the light X for your shade
 * @param {int} newX light X to set (default : 10)
 */
ShadeLayer.prototype.setLightX = function (newX) {
    this.params.uLight[0] = newX;
    this.refresh();
}

/**
 * Change the light Y for your shade
 * @param {int} newY light Y to set (default : 10)
 */
ShadeLayer.prototype.setLightY = function (newY) {
    this.params.uLight[1] = newY;
    this.refresh();
}

/**
 * Change the light Z for your shade
 * @param {int} newZ light Z to set (default : 20)
 */
ShadeLayer.prototype.setLightZ = function (newZ) {
    this.params.uLight[2] = newZ;
    this.refresh();
}

/**
 * Change the amount of shade
 * @param {int} newScale The scale to set (default : 10)
 */
ShadeLayer.prototype.setScale = function (newScale) {
    this.params.scale = newScale;
    this.refresh();
}

//---------------------------------------------------------------------------

/**
 * Return the lightX of your shade
 */
ShadeLayer.prototype.lightX = function () {
    return this.params.uLight[0] ;
}

/**
 * Return the lightY of your shade
 */
ShadeLayer.prototype.lightY = function () {
    return this.params.uLight[1] ;
}

/**
 * Return the lightZ of your shade
 */
ShadeLayer.prototype.lightZ = function () {
    return this.params.uLight[2] ;
}

/**
 * Return the amount of shade
 */
ShadeLayer.prototype.scale = function () {
    return this.params.scale ;
}

//---------------------------------------------------------------------------

/**
 * [animateLightX description]
 * @param {int} from [description]
 * @param {int} to [description]
 */
ShadeLayer.prototype.animateLightX = function (from, to) {
    var set = function (){
        var way = Math.abs(to-from)/(to-from);
        this.setLightX(from);
        var next = from + way;
        if((next - to)*way < 0){
            this.animateLightX(next, to);
        }
        else{
            this.setLightX(to);
        }
    }.bind(this);

    requestAnimationFrame(set);
}

//---------------------------------------------------------------------------

module.exports = ShadeLayer;
