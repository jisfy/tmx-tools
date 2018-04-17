
var expect = require('chai').expect
var tmxTools = require('../src/tmx-tools');
var Jimp = require('jimp');
var Q = require('q');

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


describe('maybeAddTileInCoordinatesAsync', function () {
  context('given that the tile is already in the tileset', function () {
    var tile = undefined;
    var tileWidth = 64;
    var tileHeight = 64;
    var tileBase64 = 'base64 data:image/png;base64,' + 
        'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaX' +
        'HeAAAAAklEQVR4AewaftIAAAB5SURBVOXBAQEAMAiA' +
        'ME4e+xd6EA3C9v7MEiZxEidxEidxEidxEidxEidxEi' + 
        'dxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidx' +
        'EidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEi' +
        'dxEidxEidxEidxEidxB2JWAro9dnckAAAAAElFTkSu' +
        'QmCC';
    var emptyTilesetData = {
      mapping : [],
      tiles: [],
      tileMapping : {},
    };

    beforeEach(function () {
      var tileImageFileName = './test/assets/tile.png';
      this.tile = Jimp.read(tileImageFileName);
    });

    /*
    it('should only add a new mapping not a tile', function () {
      return this.tile.then(function (tileImage) {
        // tmxTools.tilesetFromImage(image, tileTopLeftCoordinates, tileWidth, tileHeight);
        var tileAtIndexBase64$ = Q.ninvoke(tileImage, 'getBase64', Jimp.AUTO);
        tileAtIndexBase64$.then(function (base) {
          console.log('-------- base64 ' + base);
        });
      });
    });
    */

    it('should only add a new mapping not a tile', function () {
      return this.tile.then(function (tileImage) {
        var tilesetData = {
          tiles : [tileImage],
          mapping : [
            [0, 1, 0], 
            [], 
            [ 0, 0, 0 ],
          ],
          tileMapping : {},
        };
        tilesetData.tileMapping[tileBase64] = 1;
        
        // console.log('---------- tileMapping ' + JSON.stringify(tilesetData.tileMapping));
        var maybeAddTileInCoordinatesAsync = 
            tmxTools.maybeAddTileInCoordinates(2, 1, tileImage); 
        return maybeAddTileInCoordinatesAsync(tilesetData, tileBase64);  
      }).then(function (tilesetData) {
        expect(tilesetData).to.not.be.null;
        expect(tilesetData.tiles).to.be.ok;
        expect(tilesetData.tiles.length).to.be.equal(1);
        expect(tilesetData.tileMapping).to.have.property(tileBase64).equals(1);
        expect(tilesetData.mapping.length).to.be.equal(3);
        expect(tilesetData.mapping[0]).to.be.deep.equal([0, 1, 0]);
        expect(tilesetData.mapping[1]).to.be.empty
        expect(tilesetData.mapping[2][1]).to.be.equal(1);
      });
    })
  });
});
