
var tmxTools = require('../src/tmx-tools');
var expect = require('chai').expect
var Jimp = require('jimp');
var Q = require('q');

describe('TmxTools', function () {
  context('getTileTopLeftCoordinates', function () {
    var tileWidth = 64;
    var tileHeight = 64;
    var imageWidth = tileWidth * 2;
    var imageHeight = tileHeight * 2;

    it('should return a list of top-left coordinates when called with an ' +
        'imageWidth and imageHeight multiples of tileWidth and tileHeight',
            function() {
      var tileTopLeftCoordinates = tmxTools.getTileTopLeftCoordinates(
          imageWidth,
          imageHeight,
          tileWidth,
          tileHeight
      );
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
      expect(getTileTopLeftCoordinatesWithArgs).to.throw('Can not generate ' +
          'Tile coordinates with image size non divisible by tile size ');
    })
 })
})

describe('maybeAddTileInCoordinatesAsync', function () {
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

  function buildEmptyTilesetData() {
    var emptyTilesetData = {
      tiles : [],
      mapping : [
        [],
        [],
        [],
      ],
      tileMapping : {},
    };
    return emptyTilesetData;
  }

  function buildTilesetData(tileImage, tileBase64, indexHorizontal, indexVertical) {
    var tilesetData = buildEmptyTilesetData();
    tilesetData.tiles.push(tileImage);
    tilesetData.tileMapping[tileBase64] = tilesetData.tiles.length - 1;
    tilesetData.mapping[indexHorizontal][indexVertical] =
    tilesetData.tileMapping[tileBase64];
    return tilesetData;
  }

  function updateTilesetMapping(tilesetData, indexHorizontal, mappingHorizontal) {
    tilesetData.mapping[indexHorizontal] =   mappingHorizontal;
    return tilesetData;
  }

  context('given that the tile is already in the tileset', function () {
    var tile = undefined;

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
      var tileIndexHorizontal = 2;
      var tileIndexVertical = 0;
      var targetIndexHorizontal = 1;
      var targetIndexVertical = 2;
      var tilesetData =
          buildTilesetData(this.tile, tileBase64,
              tileIndexHorizontal, tileIndexVertical);
      updateTilesetMapping(tilesetData, targetIndexHorizontal,
          [undefined, undefined, undefined]);
      var expectedTilesetData =
          buildTilesetData(this.tile, tileBase64, tileIndexHorizontal,
              tileIndexVertical);
      updateTilesetMapping(expectedTilesetData, targetIndexHorizontal,
          [undefined, undefined, 0]);

      var maybeAddTileInCoordinatesAsync =
          tmxTools.maybeAddTileInCoordinates(targetIndexHorizontal,
              targetIndexVertical, this.tile);
      return maybeAddTileInCoordinatesAsync(tilesetData, tileBase64).then(
          function (resultingTilesetData) {
            expect(resultingTilesetData).to.be.deep.equal(expectedTilesetData);
          }
      );
    })
  })

  context('given that the tile is not yet in the tileset', function () {
    var tile = undefined;
    beforeEach(function () {
      var tileImageFileName = './test/assets/tile.png';
      return this.tile = Jimp.read(tileImageFileName);
    });

    it('should add a new mapping and a tile', function () {
      var tileIndexHorizontal = 2;
      var tileIndexVertical = 0;
      var tilesetData = buildEmptyTilesetData();
      var expectedTilesetData =
          buildTilesetData(this.tile, tileBase64,
              tileIndexHorizontal, tileIndexVertical);

      var maybeAddTileInCoordinatesAsync =
          tmxTools.maybeAddTileInCoordinates(tileIndexHorizontal,
              tileIndexVertical, this.tile);
      return maybeAddTileInCoordinatesAsync(tilesetData, tileBase64).then(
          function (resultingTilesetData) {
            expect(resultingTilesetData).to.be.deep.equal(expectedTilesetData);
          }
      );
    })
  })
})

describe('getTilesetImageSizeInTiles', function () {
  context('when called with a number of tiles which dont fully fit in' +
      ' a square layout', function () {
    it('like 5, should return a rectangular tileset dimension', function () {
      var tilesetDimension = tmxTools.getTilesetImageSizeInTiles(5);
      expect(tilesetDimension).to.be.ok;
      expect(tilesetDimension).to.be.deep.equal([3, 2]);
    })

    it('like 7, should return a square tileset dimension which wont be ' +
        'completely filled up', function () {
      var tilesetDimension = tmxTools.getTilesetImageSizeInTiles(7);
      expect(tilesetDimension).to.be.ok;
      expect(tilesetDimension).to.be.deep.equal([3, 3]);
    })
  })

  context('when called with a number of tiles which fully fit in' +
      ' a square layout', function () {
    it('like 4, should return a completely filled square tileset dimension',
        function () {
      var tilesetDimension = tmxTools.getTilesetImageSizeInTiles(4);
      expect(tilesetDimension).to.be.ok;
      expect(tilesetDimension).to.be.deep.equal([2, 2]);
    })
  })
})

describe('getTileTargetPositionInTileset', function () {
  context('given a square tileset dimension', function () {
    it('should return a correct tile position for its index', function () {
      var squareTilesetDimension = [2, 2];
      var getTileTargetPositionByIndex =
         tmxTools.getTileTargetPositionInTileset(squareTilesetDimension);
      expect(getTileTargetPositionByIndex(2)).to.be.deep.equal([0, 1]);
    })

    it('should throw an error for a non positive index', function () {
      var squareTilesetDimension = [2, 2];
      var nonPositiveTileIndex = -1;
      var getTileTargetPositionByIndex =
          tmxTools.getTileTargetPositionInTileset(squareTilesetDimension);
      var getTileTargetPositionByIndexWrapper = function () {
        return getTileTargetPositionByIndex(nonPositiveTileIndex);
      }
      expect(getTileTargetPositionByIndexWrapper).to.throw('Cant get a ' +
          'target position for a tile with non positive index');
    })

    it('should throw an error for a an index bigger than the tileset ' +
        'dimension', function () {
      var squareTilesetDimension = [2, 2];
      var largeTileIndex = 4;
      var getTileTargetPositionByIndex =
          tmxTools.getTileTargetPositionInTileset(squareTilesetDimension);
      var getTileTargetPositionByIndexWrapper = function () {
        return getTileTargetPositionByIndex(largeTileIndex);
      }
      expect(getTileTargetPositionByIndexWrapper).to.throw('Cant get a ' +
          'target position for a tile with index bigger than dimension');
    })
  })
})
