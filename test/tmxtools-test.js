
var rewire = require('rewire');
var chai = require('chai');
var expect = chai.expect
var Jimp = require('jimp');
var Q = require('q');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(sinonChai);
chai.use(chaiAsPromised);

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

describe('TmxTools', function () {
  context('getTileTopLeftCoordinates', function () {
    var tileWidth = 64;
    var tileHeight = 64;
    var imageWidth = tileWidth * 2;
    var imageHeight = tileHeight * 2;
    var tmxTools = undefined;

    beforeEach(function () {
      tmxTools = require('../src/tmx-tools');
    });

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

  context('given that the tile is already in the tileset', function () {
    var tile = undefined;
    var maybeAddTileInCoordinates = undefined;

    beforeEach(function () {
      var tmxTools = rewire('../src/tmx-tools');
      maybeAddTileInCoordinates = tmxTools.__get__('maybeAddTileInCoordinates');
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
          maybeAddTileInCoordinates(targetIndexHorizontal,
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
    var maybeAddTileInCoordinates = undefined;

    beforeEach(function () {
      var tmxTools = rewire('../src/tmx-tools');
      maybeAddTileInCoordinates = tmxTools.__get__('maybeAddTileInCoordinates');
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
          maybeAddTileInCoordinates(tileIndexHorizontal,
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
    var getTilesetImageSizeInTiles = undefined;

    beforeEach(function () {
      var tmxTools = rewire('../src/tmx-tools');
      getTilesetImageSizeInTiles =
          tmxTools.__get__('getTilesetImageSizeInTiles');
    });

    it('like 5, should return a rectangular tileset dimension', function () {
      var tilesetDimension = getTilesetImageSizeInTiles(5);
      expect(tilesetDimension).to.be.ok;
      expect(tilesetDimension).to.be.deep.equal([3, 2]);
    })

    it('like 7, should return a square tileset dimension which wont be ' +
        'completely filled up', function () {
      var tilesetDimension = getTilesetImageSizeInTiles(7);
      expect(tilesetDimension).to.be.ok;
      expect(tilesetDimension).to.be.deep.equal([3, 3]);
    })
  })

  context('when called with a number of tiles which fully fit in' +
      ' a square layout', function () {
    var getTilesetImageSizeInTiles = undefined;

    beforeEach(function () {
      var tmxTools = rewire('../src/tmx-tools');
      getTilesetImageSizeInTiles =
          tmxTools.__get__('getTilesetImageSizeInTiles');
    });

    it('like 4, should return a completely filled square tileset dimension',
        function () {
      var tilesetDimension = getTilesetImageSizeInTiles(4);
      expect(tilesetDimension).to.be.ok;
      expect(tilesetDimension).to.be.deep.equal([2, 2]);
    })
  })
})

describe('getTileTargetPositionInTileset', function () {
  context('given a square tileset dimension', function () {
    var getTileTargetPositionInTileset = undefined;

    beforeEach(function () {
      var tmxTools = rewire('../src/tmx-tools');
      getTileTargetPositionInTileset =
          tmxTools.__get__('getTileTargetPositionInTileset');
    });

    it('should return a correct tile position for its index', function () {
      var squareTilesetDimension = [2, 2];
      var getTileTargetPositionByIndex =
         getTileTargetPositionInTileset(squareTilesetDimension);
      expect(getTileTargetPositionByIndex(2)).to.be.deep.equal([0, 1]);
    })

    it('should throw an error for a non positive index', function () {
      var squareTilesetDimension = [2, 2];
      var nonPositiveTileIndex = -1;
      var getTileTargetPositionByIndex =
          getTileTargetPositionInTileset(squareTilesetDimension);
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
          getTileTargetPositionInTileset(squareTilesetDimension);
      var getTileTargetPositionByIndexWrapper = function () {
        return getTileTargetPositionByIndex(largeTileIndex);
      }
      expect(getTileTargetPositionByIndexWrapper).to.throw('Cant get a ' +
          'target position for a tile with index bigger than dimension');
    })
  })
})

describe('buildTilesetImage', function () {
  context('given a valid tileset and TileMapConfig', function () {
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
    var tileIndexHorizontal = 2;
    var tileIndexVertical = 0;
    var targetIndexHorizontal = 1;
    var tile = undefined;
    var tmxTools = undefined;
    var emptyTilesetData = {
      mapping : [],
      tiles: [],
      tileMapping : {},
    };

    beforeEach(function () {
      tmxTools = rewire('../src/tmx-tools');
      var tileImageFileName = './test/assets/tile.png';
      return Jimp.read(tileImageFileName).then(function (aTile) {
        tile = aTile;
      });
    });

    function getSampleTileMapConfig(targetTileMapPath) {
      var tileMapConfig = new tmxTools.TileMapConfig(
        targetTileMapPath,
        [3, 3],
        [tileWidth, tileHeight],
      );
      return tileMapConfig;
    }

    function setSpiedFunction(functionName) {
      var functionSpy = sinon.spy();
      tmxTools.__set__(functionName, functionSpy);
      return functionSpy;
    }

    function setStubbedFunction(functionName) {
      var functionStub = sinon.stub();
      tmxTools.__set__(functionName, functionStub);
      return functionStub;
    }

    it('should write the TileSet Image at the specified location', function () {
      var outputTileMapFolder = '/sample/dir/';
      var outputTileMapPath = outputTileMapFolder + 'tilemap.tmx';
      var outputTilesetImagePath = outputTileMapFolder + 'tilemap-Tileset.png';
      var tileMapConfig = getSampleTileMapConfig(outputTileMapPath);
      var tilesetData = buildTilesetData(tile, tileBase64,
          tileIndexHorizontal, tileIndexVertical);

      var writeTilesetImage = setSpiedFunction('writeTilesetImage');
      var copyTile = setSpiedFunction('copyTile');
      var buildTilesetImage = tmxTools.__get__('buildTilesetImage');
      buildTilesetImage(tilesetData, tileMapConfig);
      expect(copyTile).to.have.been.calledWith(sinon.match.instanceOf(Jimp),
          tile, [0, 0]);
      var tilesetImage = copyTile.getCall(0).args[0];
      expect(writeTilesetImage).to.have.been.calledWith(
          outputTilesetImagePath, tilesetImage);
    })

    it('should fail if the TileSet Image can not be written at the ' +
        'specified location', function () {
      var outputAccessDeniedTileMapFolder = './access_denied/';
      var outputTileMapPath = outputAccessDeniedTileMapFolder + 'tilemap.tmx';
      var outputTilesetImagePath =
          outputAccessDeniedTileMapFolder + 'tilemap-Tileset.png';
      var tileMapConfig = getSampleTileMapConfig(outputTileMapPath);
      var tilesetData = buildTilesetData(tile, tileBase64,
          tileIndexHorizontal, tileIndexVertical);

      var writeTilesetImage = setStubbedFunction('writeTilesetImage');
      var errorMessage =
          'EACCES: permission denied, open \'' + outputTilesetImagePath + '\'';
      writeTilesetImage.withArgs(sinon.match.string,
          sinon.match.instanceOf(Jimp)).returns(
              Q.reject(new Error(errorMessage)));
      var copyTile = setSpiedFunction('copyTile');
      var buildTilesetImage = tmxTools.__get__('buildTilesetImage');
      var buildTilesetImage$ = buildTilesetImage(tilesetData, tileMapConfig);
      expect(copyTile).to.have.been.calledWith(sinon.match.instanceOf(Jimp),
          tile, [0, 0]);
      return expect(buildTilesetImage$).to.be.rejectedWith(errorMessage);
    })
  })
})
