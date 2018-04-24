var XmlWriter = require('simple-xml-writer').XmlWriter;
var Jimp = require('jimp');
var _ = require('underscore');
var Q = require('q');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');

/**
 * Generates a list of pairs holding the top-left coordinates for each tile
 * candidate in the source image
 *
 * @param {number} imageWidth - the source image width in pixels
 * @param {number} imageHeight - the source image height in pixels
 * @param {number} tileWidth - the tile width in pixels
 * @param {number} tileHeight - the tile height in pixels
 * @returns {Array<Array<number, number>>} a list of pairs holding the top-left
 *     coordinates for each tile candidate in the source image
 * @throws {Error} in case the imageWidth is not divisible by the tileWidth,
 *     or the imageHeight is not divisible by the tileHeight
 */
function getTileTopLeftCoordinates(imageWidth, imageHeight, tileWidth, tileHeight) {
  var imageWidthInTiles = imageWidth / tileWidth;
  var imageHeightInTiles = imageHeight / tileHeight;
  var isNonMultipleHorizontal = (imageWidth % tileWidth != 0);
  var isNonMultipleVertical = (imageHeight % tileHeight != 0);
  if (isNonMultipleHorizontal || isNonMultipleVertical) {
    throw new Error('Can not generate Tile coordinates with image size non ' +
        'divisible by tile size ');
  }
  var tileHorizontalIndexes = _.range(imageWidthInTiles);
  var tileVerticalIndexes = _.range(imageHeightInTiles);
  var getIndexPairsForRow = (horizontalIndex => (
      tileVerticalIndexes.map(
          verticalIndex => [horizontalIndex, verticalIndex])));
  var tileTopLeftCoordinates = _.chain(tileHorizontalIndexes).
      map(getIndexPairsForRow).flatten(true).value();
  return tileTopLeftCoordinates;
}

/**
 * Creates a TileSet from an Image
 *
 * @param {Jimp} image - a bitmap image from where to bild the TileSet
 * @param {Array<Array<number, number>>} tileTopLeftCoordinates - a
 *     list of pairs containing the top-left coordinates of each tile
 *     in the given
 * @returns {Object} an object containing the TileSet built with
 *     - tiles : a list of the Tile images
 *     - tileMapping : a dictionary whose entries are the Base64 values of
 *         tiles, and values being the index of that Tile in the tiles list.
 *     - mapping : a matrix, where each position is the Tile index in the
 *         original image, and whose values are the index of the real Tile
 *         bitmap in the tiles list.
 */
function tilesetFromImage(image, tileTopLeftCoordinates, tileWidth, tileHeight) {
  var emptyTilesetData = {
    mapping : [],
    tiles: [],
    tileMapping : {},
  };

  var addTiles = function (tilesetData$, topLeftTileCoordinates) {
    var tileAtIndex =
        buildTileImage(image, topLeftTileCoordinates, tileWidth, tileHeight);
    // transforms the asynchronous getBase64 method of Jimp into a Promise
    var tileAtIndexBase64$ = Q.ninvoke(tileAtIndex, 'getBase64', Jimp.AUTO);
    // build a Promise that settles when the Promises for tilesetData and
    // the Base64 encoding of the Tile, both settle
    var tilesetDataWithNewTile$ =
        Q.all([tilesetData$, tileAtIndexBase64$]).spread(
            maybeAddTileInCoordinates(
                topLeftTileCoordinates[0],
                topLeftTileCoordinates[1],
                tileAtIndex
            )
        );
    return tilesetDataWithNewTile$;
  };
  var tilesetDataSoFar$ = Q(emptyTilesetData);
  var tilesetDataWholeImage$ =
      _.reduce(tileTopLeftCoordinates, addTiles, tilesetDataSoFar$);
  return tilesetDataWholeImage$;
}

/**
 * Builds a Tile from a source Image
 *
 * @param {Jimp} image - the source image from which to build the Tile
 * @param {Array<number>} topLeftIndex - a pair with the top-left indexes
 *     of the Tile in the source image
 * @param {number} tileWidth - the width of the new Tile in pixels
 * @param {number} tileHeight - the height of the new Tile in pixels
 * @returns {Jimp} - a new Tile of the given width and height, whose
 *     content pixels are copied from the corresponding position in the
 *     source image
 */
function buildTileImage(image, topLeftIndex, tileWidth, tileHeight) {
  var tileTargetHorizontalPosition = 0;
  var tileTargetVerticalPosition = 0;
  var sourceImageHorizontalPosition = topLeftIndex[1] * tileWidth;
  var sourceImageVerticalPosition = topLeftIndex[0] * tileHeight;
  var tile = new Jimp(tileWidth, tileHeight);
  tile.blit(image,
      tileTargetHorizontalPosition,
      tileTargetVerticalPosition,
      sourceImageHorizontalPosition,
      sourceImageVerticalPosition,
      tileWidth,
      tileHeight);

  return tile;
}

/**
 * Builds a Closure over a Tile, and its index position in the source image,
 * which will then add it to the Tile Set if not already present
 *
 * @param {number} tileIndexLeft - the horizontal index the Tile occupies in
 *     the source image
 * @param {number} tileIndexTop - the vertical index the Tile occupies in the
 *     source image
 * @param {Jimp} tile - the Tile bitmap to add to the Tile Set
 * @returns {function} - A function (tilesetData, tileBase64) =>
 *     Promise(tilesetData) that will add the given Tile at position
 *     tileIndexLeft, tileIndexTop to the given Tile Set if its Base64
 *     encoding is not already present.
 */
var maybeAddTileInCoordinates = function (tileIndexLeft, tileIndexTop, tile) {
  var maybeAddTileInCoordinatesAsync = function (tilesetData, tileBase64) {
      var isTileBase64InTileset = tileBase64 in tilesetData.tileMapping;
      if (!isTileBase64InTileset) {
        tilesetData.tiles.push(tile);
        tilesetData.tileMapping[tileBase64] = (tilesetData.tiles.length - 1);
      }
      if (tilesetData.mapping[tileIndexLeft] === undefined) {
        tilesetData.mapping[tileIndexLeft] = [];
      }
      tilesetData.mapping[tileIndexLeft][tileIndexTop] =
          tilesetData.tileMapping[tileBase64];
      return Q(tilesetData);
  };
  return maybeAddTileInCoordinatesAsync;
}

/**
 * Calculates the dimension of a Tileset Image (in number of tiles) able to
 * host the number of tiles given
 *
 * @param {number} numberOfTilesInTileset - the number of Tiles our Tile Set
 *     should be able to host
 * @returns {Array<number, number>} - a pair containing the number of rows, and
 *     number of columns (in tile units) that our target Tile Set image should
 *     have in order to host the given number of tiles
 */
function getTilesetImageSizeInTiles(numberOfTilesInTileset) {
  var tilesetSquareImageSizeInTiles = Math.sqrt(numberOfTilesInTileset);
  var tilesetSquareImageSizeInteger =
      Math.floor(tilesetSquareImageSizeInTiles);
  var tilesetSquareImageSizeSquared =
      Math.pow(tilesetSquareImageSizeInteger, 2);
  var remainingTilesNotFittingInSquareImage =
      numberOfTilesInTileset - tilesetSquareImageSizeSquared;
  var extraTileColumns = 0;
  var extraTileRows = 0;
  if (remainingTilesNotFittingInSquareImage > 0) {
    extraTileColumns = Math.floor(
        remainingTilesNotFittingInSquareImage / tilesetSquareImageSizeInteger);
    extraTileRows =
        remainingTilesNotFittingInSquareImage % tilesetSquareImageSizeInteger;
    if (extraTileColumns === 0) {
      // preferrably grow the tileset horizontally adding more columns
      // swap extra columns and rows if the original extra columns is zero
      extraTileColumns = extraTileRows;
      extraTileRows = 0;
    }
  }

  var tilesetImageHorizontalSizeInTiles =
      tilesetSquareImageSizeInteger + extraTileColumns;
  var tilesetImageVerticalSizeInTiles =
      tilesetSquareImageSizeInteger + extraTileRows;
  var tilesetImageSizeInTiles =
      [tilesetImageHorizontalSizeInTiles, tilesetImageVerticalSizeInTiles];

  return tilesetImageSizeInTiles;
}

/**
 * Copies the content of a given Tile into a target Tile Set image
 *
 * @param {Jimp} tilesetImage -the target Tile Set image where we would like
 *     to copy the given Tile
 * @param {Jimp} tile - the source Tile image to copy
 * @param {Array<number>} tilePositionInTileset - the position (in tile units)
 *     in the given Tile Set image where we would like to copy the source Tile
 */
var copyTile = function (tilesetImage, tile, tilePositionInTileset) {
  var tileHorizontalPositionInTileset = tilePositionInTileset[0];
  var tileVerticalPositionInTileset = tilePositionInTileset[1];
  var tileWidth = tile.bitmap.width;
  var tileHeight = tile.bitmap.height;
  var sourceImageHorizontalPosition = 0;
  var sourceImageVerticalPosition = 0;
  var tileTargetHorizontalPosition = tileHorizontalPositionInTileset * tileWidth;
  var tileTargetVerticalPosition =  tileVerticalPositionInTileset * tileHeight;
  tilesetImage.blit(tile,
      tileTargetHorizontalPosition,
      tileTargetVerticalPosition,
      sourceImageHorizontalPosition,
      sourceImageVerticalPosition,
      tileWidth,
      tileHeight);
}

function isTileIndexNonNegative(tileIndex) {
  return (tileIndex >= 0);
}

function isTileIndexWithinBounds(tileRowIndex, tilesetNumberOfRows) {
  return (tileRowIndex < tilesetNumberOfRows);
}

/**
 * Builds a closure on the Tile Set Size, which will calculate the position of
 * a Tile given its index in the target Tile Set image
 *
 * @param {Array<number>} tilesetSizeInTiles - a pair with the size of the Tile
 *     Set in Tile units, where;
 *     - tilesetSizeInTiles[0] : is the horizontal size in Tile units (or number of columns)
 *     - tilesetSizeInTiles[1] : is the vertical size in Tile units (or number of rows)
 * @returns {function} - (number) => Array<number> , a function that given a tile
 *     index (in the complete list of tiles of the target Tile Set), will return
 *     its corresponding position (in Tile units) in the target Tile Set image
 *
 */
function getTileTargetPositionInTileset(tilesetSizeInTiles) {
  var getTileTargetPositionByIndex = function (tileIndex) {
    if (!isTileIndexNonNegative(tileIndex)) {
      throw new Error('Cant get a target position for a tile with ' +
          'non positive index');
    }
    var tilesetNumberOfRows = tilesetSizeInTiles[1];
    var tilesetNumberOfColumns = tilesetSizeInTiles[0];
    var tileRowIndex = Math.floor(tileIndex / tilesetNumberOfColumns);
    if (!isTileIndexWithinBounds(tileRowIndex, tilesetNumberOfRows)) {
      throw new Error('Cant get a target position for a tile with ' +
          'index bigger than dimension');
    }
    var tileColumnIndex = Math.floor(tileIndex % tilesetNumberOfColumns);
    return [tileColumnIndex, tileRowIndex];
  };
  return getTileTargetPositionByIndex;
}

/**
 * Writes a given Tile Set image to the filesystem under the given file path
 *
 * @param {string} tilesetImageFilename - the filename path in the filesystem
 *     where we would like to write the Tile Set image
 * @returns {Promise} - a Promise of a Tile Set Image being written to the
 *     filesystem in the given path
 */
var writeTilesetImage = function (tilesetImageFilename, tilesetImage) {
  var writeTilesetImage$ =
      Q.ninvoke(tilesetImage, 'write', tilesetImageFilename);
  return writeTilesetImage$;
}

/**
 * Builds and writes a Tile Set Image to the filesystem
 *
 * @param {string} tilesetImageFilename - the path where to write the Tile Set
 *     image in the filesystem
 * @param {Object} tilesetData - the TilesetData object holding the list of
 *     Tiles to use to build the Tile Set Image
 * @param {Array<number>} tileSizePixels - a pair containing the width and
 *     height in pixels of a Tile
 * @returns {Promise} - a Promise of the Tile Set Image being written to the
 *     filesystem correctly
 */
function buildTilesetImage(tilesetData, tileMapConfig) {
  var tilesetSizeInTiles = getTilesetImageSizeInTiles(tilesetData.tiles.length);
  var tilesetWidthPixels =
      tilesetSizeInTiles[0] * tileMapConfig.tileSizePixels[0];
  var tilesetHeightPixels =
      tilesetSizeInTiles[1] * tileMapConfig.tileSizePixels[1];
  var tilesetImage = new Jimp(tilesetWidthPixels, tilesetHeightPixels);
  var getTileTargetPositionByIndex =
      getTileTargetPositionInTileset(tilesetSizeInTiles);
  var copyTileIntoCorrespodingPositionInTilesetImage = (tile, index) => {
    var tilePositionInTilesetImage = getTileTargetPositionByIndex(index);
    copyTile(tilesetImage, tile, tilePositionInTilesetImage);
  };
  _.map(tilesetData.tiles, copyTileIntoCorrespodingPositionInTilesetImage);
  return writeTilesetImage(tileMapConfig.getTilesetImagePath(), tilesetImage);
}

var compression = {
  gzip : function (buffer) {
    var gzippedBuffer = zlib.gzipSync(buffer);
    return gzippedBuffer;
  },
  zlib : function (buffer) {
    var zlibbedBuffer = zlib.deflateSync(buffer);
    return zlibbedBuffer;
  },
  none : function (buffer) {
    return buffer;
  },
};

/**
 * Creates a new TileMapConfig instance, which will hold the information
 * necessary to write a .tmx file, compression algorithm, tile size in pixels,
 * map size in tiles, .tmx version, orientation, etc.
 * @class
 */
function TileMapConfig(fileName, mapSizeTiles, tileSizePixels) {
  this.version = '1.0';
  this.orientation = 'orthogonal';
  this.compressionAlgorithm = 'gzip';
  this.fileName = fileName;
  this.mapSizeTiles = mapSizeTiles;
  this.tileSizePixels = tileSizePixels;
}

/**
 * Gets the layer name to be used in a .tmx file for the current TileMap
 *
 * @returns {string} - the layer name for the current TileMap instance
 */
TileMapConfig.prototype.getLayerName = function () {
  var layerNameWithExtension = path.basename(this.fileName);
  var layerNameExtension = path.extname(layerNameWithExtension);
  var layerName = path.basename(layerNameWithExtension, layerNameExtension);
  return layerName;
}

/**
 * Gets the TileSet name to be used in a .tmx file for the current TileMap
 *
 * @returns {string} - the TileSet name for the current TileMap instance
 */
TileMapConfig.prototype.getTilesetName = function () {
  var tilesetName = this.getLayerName();
  return tilesetName;
}

/**
 * Gets the TileSet image file name to be used in a .tmx file for the current
 * TileMap
 *
 * @returns {string} - the TileSet image file name for the current TileMap
 *     instance
 */
TileMapConfig.prototype.getTilesetImageFileName = function () {
  var layerName = this.getLayerName();
  var tilesetImageFileName =  layerName + '-Tileset.png';
  return tilesetImageFileName;
}

/**
 * Gets the TileSet image path to be used in a .tmx file for the current
 * TileMap
 *
 * @returns {string} - the TileSet image path for the current TileMap
 *     instance
 */
TileMapConfig.prototype.getTilesetImagePath = function () {
  var tilesetImageFileName = this.getTilesetImageFileName();
  var tilesetPath = path.dirname(this.fileName);
  var tilesetImagePath = tilesetPath + '/' + tilesetImageFileName;
  return tilesetImagePath;
}

/**
 * Builds the Data content for a Tmx Layer. The content will be a list of 32
 * bit, unsigned integers, with little endian encoding, then encoded in Base64
 *
 * @param {Object} tilesetData - the TilesetData object holding the mapping of
 *     Tile positions in the original bitmap image to actual Tile indexes
 * @param {string} compressionAlgorithm - the Compression Algorithm to use to
 *     compress the tileset data, prior to base64 encoding it. The accepted
 *     values are those of the keys of the global "compression" object.
 * @returns {string} - a Base64 encoded string, built from a list of little
 *     endian, 32 bit, unsigned integers, holding the indexes of Tiles in a
 *     Tile Set image. The position in the list of 32 bit integers, correspond
 *     to the position of the Tile in the original bitmap image. This is, a
 *     flattened down version of the TilesetData.mapping matrix
 */
function buildLayerData(tilesetData, compressionAlgorithm) {
  var flattenedTilesetMapping =
      _.flatten(tilesetData.mapping, true).map(x => x + 1);
  var unsigned32IntArrayTilesetMapping =
      Uint32Array.from(flattenedTilesetMapping);
  var tilesetBuffer =
      Buffer.from(unsigned32IntArrayTilesetMapping.buffer, 0,
          unsigned32IntArrayTilesetMapping.byteLength);
  var tilesetZipped = compression[compressionAlgorithm](tilesetBuffer);
  var tilesetZippedBase64 = tilesetZipped.toString('base64');
  return tilesetZippedBase64;
}

/**
 * Builds a representation of the attributes of the 'map' element that
 * conforms with the corresponding section of a .tmx file format
 *
 * @param {function} at - a Simple Xml Writter attribute function
 * @param {TileMapConfig} tileMapConfig - the TileMap necessary information to
 *     create a well formed .tmx file.
 */
function buildTmxMapElementAttributes(at, tileMapConfig) {
  at('version', tileMapConfig.version);
  at('orientation', tileMapConfig.orientation);
  at('width', tileMapConfig.mapSizeTiles[0]);
  at('height', tileMapConfig.mapSizeTiles[1]);
  at('tilewidth', tileMapConfig.tileSizePixels[0]);
  at('tileheight', tileMapConfig.tileSizePixels[1]);
}

/**
 * Builds a representation of our TileMap, that conforms with the 'tileset'
 * element section of a .tmx file format
 *
 * @param {function} el - a Simple Xml Writter element function
 * @param {number} firstgid - the first tile gid present in the represented
 *     TileSet
 * @param {TileMapConfig} tileMapConfig - the TileMap necessary information to
 *     create a well formed .tmx file.
 * @param {Array<number>} tilesetSizePixels - a pair with the TileSet size in
 *     pixel units.
 */
function buildTmxTilesetElement(el, firstgid, tileMapConfig, tilesetSizePixels) {
  el('tileset', function (el, at) {
    at('firstgid', firstgid);
    at('name', tileMapConfig.getTilesetName());
    at('tilewidth', tileMapConfig.tileSizePixels[0]);
    at('tileheight', tileMapConfig.tileSizePixels[1]);
    el('image', function (el, at) {
      at('source', tileMapConfig.getTilesetImageFileName());
      at('width', tilesetSizePixels[0]);
      at('height', tilesetSizePixels[1]);
    })
  });
}

/**
 * Builds a representation of the given TileSet Data, that conforms with the
 * 'layer' element section of a .tmx file format
 *
 * @param {function} el - a Simple Xml Writter element function
 * @param {Object} tilesetData - the TileSetData holding the .tmx Layer Data
 *     we would like to write
 * @param {TileMapConfig} tileMapConfig - the TileMap necessary information to
 *     create a well formed .tmx file.
 */
function buildTmxLayerElement(el, tilesetData, tileMapConfig) {
  var encodedLayerData =
      buildLayerData(tilesetData, tileMapConfig.compressionAlgorithm);
  el('layer', function (el, at) {
    at('name', tileMapConfig.getLayerName());
    at('width', tileMapConfig.mapSizeTiles[0]);
    at('height', tileMapConfig.mapSizeTiles[1]);
    el('data', function (el, at, text) {
      at('encoding', 'base64');
      if (tileMapConfig.compressionAlgorithm != 'none') {
        at('compression', tileMapConfig.compressionAlgorithm);
      }
      text(encodedLayerData);
    })
  });
}

/**
 * Builds a string with the content of the given TileSet Data, that conforms
 * with the .tmx file format
 *
 * @param {Object} tilesetData - the TileSetData information required to create
 *     the .tmx file and its corresponding layer element.
 * @param {TileMapConfig} tileMapConfig - the TileMap necessary information to
 *     create a well formed .tmx file.
 * @returns {string} - a Promise holding a string with the .tmx file contents
 */
function buildTmxFileContent(tilesetData, tileMapConfig) {
  var tilesetImage$ = buildTilesetImage(tilesetData, tileMapConfig);
  var tmxFileContent$ = tilesetImage$.then(function (tilesetImage) {
    var tilesetSizePixels =
        [tilesetImage.bitmap.width, tilesetImage.bitmap.height];
    var firstgid = 1;
    var tmxFileContent = new XmlWriter(function (el) {
      el('map', function (el, at) {
        buildTmxMapElementAttributes(at, tileMapConfig);
        buildTmxTilesetElement(el, firstgid, tileMapConfig, tilesetSizePixels);
        buildTmxLayerElement(el, tilesetData, tileMapConfig);
      });
    }, { addDeclaration : true });
    return tmxFileContent;
  });
  return tmxFileContent$;
}

/**
 * Writes a .tmx file representing the TileMap given in the tilesetData argument
 * and whose details are also specified in the accompanying TileMapConfig
 * instance.
 *
 * @param {Object} tilesetData - the TileSetData information required to create
 *     the .tmx file and its corresponding layer element.
 * @param {TileMapConfig} tileMapConfig - the TileMap necessary information to
 *     create a well formed .tmx file.
 */
function writeTmxFile(tilesetData, tileMapConfig) {
    var tmxFileContent$ = buildTmxFileContent(tilesetData, tileMapConfig);
    var writeTmxFile$ = tmxFileContent$.then(function (tmxFileContent) {
      var fsWriteFileDenoified = Q.denodeify(fs.writeFile);
      var writeTmxFileContent$ =
          fsWriteFileDenoified(tileMapConfig.fileName,
              tmxFileContent.toString());
      return writeTmxFileContent$;
    });
    return writeTmxFile$;
}

module.exports = {
  getTileTopLeftCoordinates: getTileTopLeftCoordinates,
  tilesetFromImage : tilesetFromImage,
  writeTmxFile : writeTmxFile,
  TileMapConfig : TileMapConfig,
};
