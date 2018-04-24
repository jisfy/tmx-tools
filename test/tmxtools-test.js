
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

var tmxFileExtension = '.tmx';
var validTile1ImageFileName = './test/assets/tile.png';
var validLayerName = 'tileMap';
var validTilesetName = validLayerName;
var validFileName = validLayerName + tmxFileExtension;
var validTilesetImageFileName = validTilesetName + '-Tileset.png';
var validPath = '/some/folder/';
var validTilesetImagePath = validPath + validTilesetImageFileName;
var validTmxFilePath = validPath + validFileName;
var validMapSizeTiles = [3, 3];
var validTileSizePixels = [64, 64];
var tile1Base64 = 'base64 data:image/png;base64,' +
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaX' +
    'HeAAAAAklEQVR4AewaftIAAAB5SURBVOXBAQEAMAiA' +
    'ME4e+xd6EA3C9v7MEiZxEidxEidxEidxEidxEidxEi' +
    'dxEidxEidxEidxEidxEidxEidxEidxEidxEidxEidx' +
    'EidxEidxEidxEidxEidxEidxEidxEidxEidxEidxEi' +
    'dxEidxEidxEidxEidxB2JWAro9dnckAAAAAElFTkSu' +
    'QmCC';

function setSpiedFunction(functionName, tmxTools) {
  var functionSpy = sinon.spy();
  tmxTools.__set__(functionName, functionSpy);
  return functionSpy;
}

function setStubbedFunctionWith(functionName, functionStub, tmxTools) {
  tmxTools.__set__(functionName, functionStub);
  return functionStub;
}

function setStubbedFunction(functionName, tmxTools) {
  var functionStub = sinon.stub();
  return setStubbedFunctionWith(functionName, functionStub, tmxTools);
}

function getTileImage(callBack) {
  return Jimp.read(validTile1ImageFileName).then(callBack);
}

function getTileImageEventually() {
  return Jimp.read(validTile1ImageFileName);
}

function getSampleTileMapConfig(tmxTools, targetTileMapPath,
      tileSize, tileMapSize) {
  var tileMapConfig = new tmxTools.TileMapConfig(
    targetTileMapPath,
    [tileMapSize[0], tileMapSize[1]],
    [tileSize[0], tileSize[1]],
  );
  return tileMapConfig;
}

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
    var imageWidth = validTileSizePixels[0] * 2;
    var imageHeight = validTileSizePixels[1] * 2;
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
          validTileSizePixels[0],
          validTileSizePixels[1]
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
            validTileSizePixels[0],
            validTileSizePixels[1]
        );
      };
      expect(getTileTopLeftCoordinatesWithArgs).to.throw('Can not generate ' +
          'Tile coordinates with image size non divisible by tile size ');
    })
 })
})

describe('maybeAddTileInCoordinatesAsync', function () {
  context('given that the tile is already in the tileset', function () {
    var maybeAddTileInCoordinates = undefined;

    beforeEach(function () {
      var tmxTools = rewire('../src/tmx-tools');
      maybeAddTileInCoordinates = tmxTools.__get__('maybeAddTileInCoordinates');
      this.tile = getTileImageEventually();
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
          buildTilesetData(this.tile, tile1Base64,
              tileIndexHorizontal, tileIndexVertical);
      updateTilesetMapping(tilesetData, targetIndexHorizontal,
          [undefined, undefined, undefined]);
      var expectedTilesetData =
          buildTilesetData(this.tile, tile1Base64, tileIndexHorizontal,
              tileIndexVertical);
      updateTilesetMapping(expectedTilesetData, targetIndexHorizontal,
          [undefined, undefined, 0]);

      var maybeAddTileInCoordinatesAsync =
          maybeAddTileInCoordinates(targetIndexHorizontal,
              targetIndexVertical, this.tile);
      return maybeAddTileInCoordinatesAsync(tilesetData, tile1Base64).then(
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
      this.tile = getTileImageEventually();
    });

    it('should add a new mapping and a tile', function () {
      var tileIndexHorizontal = 2;
      var tileIndexVertical = 0;
      var tilesetData = buildEmptyTilesetData();
      var expectedTilesetData =
          buildTilesetData(this.tile, tile1Base64,
              tileIndexHorizontal, tileIndexVertical);

      var maybeAddTileInCoordinatesAsync =
          maybeAddTileInCoordinates(tileIndexHorizontal,
              tileIndexVertical, this.tile);
      return maybeAddTileInCoordinatesAsync(tilesetData, tile1Base64).then(
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
    var tileIndexHorizontal = 2;
    var tileIndexVertical = 0;
    var targetIndexHorizontal = 1;
    var tile = undefined;
    var tmxTools = undefined;

    beforeEach(function () {
      tmxTools = rewire('../src/tmx-tools');
      return getTileImage(function (aTile) {
        tile = aTile;
      });
    });

    it('should write the TileSet Image at the specified location', function () {
      var outputTileMapFolder = '/sample/dir/';
      var outputTileMapPath = outputTileMapFolder + 'tilemap.tmx';
      var outputTilesetImagePath = outputTileMapFolder + 'tilemap-Tileset.png';
      var tileMapConfig = getSampleTileMapConfig(tmxTools, outputTileMapPath,
          validTileSizePixels, validMapSizeTiles);
      var tilesetData = buildTilesetData(tile, tile1Base64,
          tileIndexHorizontal, tileIndexVertical);

      var writeTilesetImage = setSpiedFunction('writeTilesetImage', tmxTools);
      var copyTile = setSpiedFunction('copyTile', tmxTools);
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
      var tileMapConfig = getSampleTileMapConfig(tmxTools, outputTileMapPath,
          validTileSizePixels, validMapSizeTiles);
      var tilesetData = buildTilesetData(tile, tile1Base64,
          tileIndexHorizontal, tileIndexVertical);

      var writeTilesetImage = setStubbedFunction('writeTilesetImage', tmxTools);
      var errorMessage =
          'EACCES: permission denied, open \'' + outputTilesetImagePath + '\'';
      writeTilesetImage.withArgs(sinon.match.string,
          sinon.match.instanceOf(Jimp)).rejects(new Error(errorMessage));

      var copyTile = setSpiedFunction('copyTile', tmxTools);
      var buildTilesetImage = tmxTools.__get__('buildTilesetImage');
      var buildTilesetImage$ = buildTilesetImage(tilesetData, tileMapConfig);
      expect(copyTile).to.have.been.calledWith(sinon.match.instanceOf(Jimp),
          tile, [0, 0]);
      return expect(buildTilesetImage$).to.be.rejectedWith(errorMessage);
    })
  })
})

describe('buildTmxFileContent', function () {
  context('given a valid TilesetData and TileMapConfig', function () {
    var tmxTools = undefined;
    var tile = undefined;
    var tileIndexHorizontal = 2;
    var tileIndexVertical = 0;

    beforeEach(function (){
      tmxTools = rewire('../src/tmx-tools');
      return getTileImage(function (aTile) {
        tile = aTile;
      });
    })

    function buildSampleTmxContent(tileSizePixels,
        tileMapSizeTiles, tilesetSizePixels) {
      var sampleTmxContent = '<?xml version="1.0" encoding="UTF-8"?>\r\n' +
          '<map version="1.0" orientation="orthogonal" width="' +
          tileMapSizeTiles[0]+'" height="' + tileMapSizeTiles[1] + '"' +
          ' tilewidth="' + tileSizePixels[0] +'" tileheight="' +
          tileSizePixels[1] + '">\r\n  <tileset firstgid="1" ' +
          'name="tilemap" tilewidth="' + tileSizePixels[0] +
          '" tileheight="' + tileSizePixels[1] + '">\r\n    ' +
          '<image source="tilemap-Tileset.png" width="' +
          tilesetSizePixels[0] +'" height="' + tilesetSizePixels[1] +
          '"/>\r\n  </tileset>\r\n  <layer name="tilemap" width="' +
          tileMapSizeTiles[0] +'" height="' + tileMapSizeTiles[1] + '">\r\n' +
          '    <data encoding="base64" compression="gzip">' +
          'H4sIAAAAAAAAA2NkYGAAAHm4+JkEAAAA</data>\r\n  </layer>\r\n</map>';

      return sampleTmxContent;
    }

    it('should return a valid .tmx file content', function () {
      var outputTileMapFolder = '/sample/dir/';
      var outputTileMapPath = outputTileMapFolder + 'tilemap.tmx';
      var outputTilesetImagePath = outputTileMapFolder + 'tilemap-Tileset.png';
      var tileMapConfig = getSampleTileMapConfig(tmxTools, outputTileMapPath,
          validTileSizePixels, validMapSizeTiles);
      var tilesetData = buildTilesetData(tile, tile1Base64,
          tileIndexHorizontal, tileIndexVertical);

      var tilesetWidthPixels = validTileSizePixels[0] * 2;
      var tilesetHeightPixels = validTileSizePixels[1] * 2;
      var tilesetImage = new Jimp(tilesetWidthPixels, tilesetHeightPixels);
      var buildTilesetImage = setStubbedFunction('buildTilesetImage', tmxTools);
      buildTilesetImage.resolves(tilesetImage);

      var buildTmxFileContent = tmxTools.__get__('buildTmxFileContent');
      var buildTmxFileContent$ = buildTmxFileContent(tilesetData, tileMapConfig);
      var resultingTmxContent =
          buildSampleTmxContent(validTileSizePixels, validMapSizeTiles,
            [tilesetWidthPixels, tilesetHeightPixels]);
      var buildTmxFileContentToString$ =
          buildTmxFileContent$.then(function (simpleXmlWriterContent) {
            return simpleXmlWriterContent.toString();
          });

      return expect(buildTmxFileContentToString$).
          to.eventually.equal(resultingTmxContent);
    })

    it('should fail if the TileSet Image can not be written at the ' +
        'specified location', function () {
      var outputAccessDeniedTileMapFolder = './access_denied/';
      var outputTileMapPath = outputAccessDeniedTileMapFolder + 'tilemap.tmx';
      var outputTilesetImagePath =
          outputAccessDeniedTileMapFolder + 'tilemap-Tileset.png';
      var tileMapConfig = getSampleTileMapConfig(tmxTools, outputTileMapPath,
          validTileSizePixels, validMapSizeTiles);
      var tilesetData = buildTilesetData(tile, tile1Base64,
          tileIndexHorizontal, tileIndexVertical);

      var buildTilesetImage = setStubbedFunction('buildTilesetImage', tmxTools);
      var errorMessage =
          'EACCES: permission denied, open \'' + outputTilesetImagePath + '\'';
      buildTilesetImage.rejects(new Error(errorMessage));

      var buildTmxFileContent = tmxTools.__get__('buildTmxFileContent');
      var buildTmxFileContent$ = buildTmxFileContent(tilesetData, tileMapConfig);
      return expect(buildTmxFileContent$).to.be.rejectedWith(errorMessage);
    })
  })
})

describe('TileMapconfig', function () {
  context('given its well formed', function () {
    var tileMapConfig = undefined;
    var tmxTools = undefined;

    beforeEach(function (){
      tmxTools = require('../src/tmx-tools');
      tileMapConfig = new tmxTools.TileMapConfig(validTmxFilePath,
          validMapSizeTiles, validTileSizePixels);
    })

    it('getLayerName should return a valid Layer Name', function () {
      expect(tileMapConfig.getLayerName()).to.be.equal(validLayerName);
    })

    it('getTilesetName should return a valid Tileset Name', function () {
      expect(tileMapConfig.getTilesetName()).to.be.equal(validTilesetName);
    })

    it('getTilesetImageFileName should return a valid Tileset ' +
        'Image Filename', function () {
      expect(tileMapConfig.getTilesetImageFileName()).
          to.be.equal(validTilesetImageFileName);
    })

    it('getTilesetImagePath should return a valid Tileset Image Path',
        function () {
      expect(tileMapConfig.getTilesetImagePath()).
          to.be.equal(validTilesetImagePath);
    })
  })
})

describe('writeTmxFile', function () {
  context('given a valid TilesetData and TileMapConfig', function () {
    var tmxTools = undefined;
    var tilesetData = undefined;
    var tile = undefined;
    var tileIndexHorizontal = 2;
    var tileIndexVertical = 0;
    var fakeTmxFileContent = '<map...';

    beforeEach(function () {
      tmxTools = rewire('../src/tmx-tools');
      tileMapConfig = new tmxTools.TileMapConfig(validTmxFilePath,
          validMapSizeTiles, validTileSizePixels);
      return getTileImage(function (aTile) {
        tile = aTile;
      });
    })

    function Fs() {
    }

    Fs.prototype.writeFile = function (fileName, content, cb) {
      cb(null, '');
    }

    it('should write a generated TileMap to the given output .tmx file',
        function() {
      tilesetData = buildTilesetData(tile, tile1Base64,
              tileIndexHorizontal, tileIndexVertical);
      var tileMapConfig = getSampleTileMapConfig(
          tmxTools, validTilesetImagePath, validTileSizePixels,
              validMapSizeTiles);
      var buildTmxFileContent =
          setStubbedFunction('buildTmxFileContent', tmxTools);
      buildTmxFileContent.resolves(fakeTmxFileContent);

      var fs = new Fs();
      var fsWriteFile = sinon.mock(fs);
      fsWriteFile.expects('writeFile').withArgs(
          validTilesetImagePath, fakeTmxFileContent).callsArg(2);
      var fs = setStubbedFunctionWith('fs', fs, tmxTools);

      return tmxTools.writeTmxFile(tilesetData, tileMapConfig).then(function () {
        fsWriteFile.verify();
      });
    })

  })
})
