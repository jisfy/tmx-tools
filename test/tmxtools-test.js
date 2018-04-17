
var expect = require('chai').expect
var tmxTools = require('../src/tmx-tools');

describe('A TileMap', function () {
  context('getTileTopLeftCoordinates', function () {
    var tileWidth = 64;
    var tileHeight = 64;
    var imageWidth = tileWidth * 2;
    var imageHeight = tileHeight * 2;

    it('should return a list of top-left coordinates when called with an ' +
        'imageWidth and imageHeight multiples of tileWidth and tileHeight', function() { 
      var tileTopLeftCoordinates = tmxTools.getTileTopLeftCoordinates(imageWidth, 
          imageHeight, 
          tileWidth, 
          tileHeight); 
      expect(tileTopLeftCoordinates).to.not.be.null;
      expect(tileTopLeftCoordinates).to.be.deep.equal([[0, 0], [0, 1], 
         [1, 0], [1, 1]]);
    }) 
    it('should throw an Error when called with an imageWidth or imageHeight' + 
        ' which is not a multiple of tileWidth or tileHeight', function() { 
      var nonMultipleImageWidth = imageWidth + 2;
      var getTileTopLeftCoordinatesWithArgs = function () {
        tmxTools.getTileTopLeftCoordinates(nonMultipleImageWidth, 
            imageHeight,
            tileWidth,
            tileHeight
        );
      };
      expect(getTileTopLeftCoordinatesWithArgs).to.throw('Can not generate Tile ' + 
          'coordinates with image size non divisible by tile size ');
    }) 
 })
});
