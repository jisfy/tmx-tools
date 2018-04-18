
var XmlWriter = require('simple-xml-writer').XmlWriter;
var Jimp = require('jimp');
var _ = require('underscore');
var Q = require('q');

/**
 * Generates a list of pairs holding the top-left coordinates for each tile
 * candidate in the source image
 *
 * @param {number} imageWidth - the source image width in pixels
 * @param {number} imageHeight - the source image height in pixels
 * @param {number} tileWidth - the tile width in pixels
 * @param {number} tileHeight - the tile height in pixels
 * @return {Array<Array<number, number>>} a list of pairs holding the top-left
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
 * @return {Object} an object containing the TileSet built with
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
 * @return {Jimp} - a new Tile of the given width and height, whose
 *     content pixels are copied from the corresponding position in the
 *     source image
 */
function buildTileImage(image, topLeftIndex, tileWidth, tileHeight) {
  var tileTargetHorizontalPosition = 0;
  var tileTargetVerticalPosition = 0;
  var sourceImageHorizontalPosition = topLeftIndex[0] * tileWidth;
  var sourceImageVerticalPosition = topLeftIndex[1] * tileHeight;
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
 * @return {function} - A function (tilesetData, tileBase64) =>
 *     Promise(tilesetData) that will add the given Tile at position
 *     tileIndexLeft, tileIndexTop to the given Tile Set if its Base64
 *     encoding is not already present.
 */
function maybeAddTileInCoordinates(tileIndexLeft, tileIndexTop, tile) {
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
 * @return {Array<number, number>} - a pair containing the number of rows, and
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
  console.log('----------> tilesetImageSizeInTiles ' + tilesetImageSizeInTiles +
      '.. numberOfTilesInTileset ' + numberOfTilesInTileset);
  return tilesetImageSizeInTiles;
}

function copyTile(tilesetImage, tile, tilePositionInTileset) {
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
 * @return {function} - (number) => Array<number> , a function that given a tile
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
    console.log('-------- getTileTargetPositionByIndex ' + tileIndex + ',' + tileRowIndex + '..' + tilesetSizeInTiles);
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
 * @return {Promise} - a Promise of a Tile Set Image being written to the
 *     filesystem in the given path
 */
function writeTilesetImage(tilesetImageFilename, tilesetImage) {
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
 * @return {Promise} - a Promise of the Tile Set Image being written to the
 *     filesystem correctly
 */
function buildTilesetImage(tilesetImageFilename, tilesetData, tileSizePixels) {
  var tilesetSizeInTiles = getTilesetImageSizeInTiles(tilesetData.tiles.length);
  var tilesetWidthPixels = tilesetSizeInTiles[0] * tileSizePixels[0];
  var tilesetHeightPixels = tilesetSizeInTiles[1] * tileSizePixels[1];
  var tilesetImage = new Jimp(tilesetWidthPixels, tilesetHeightPixels);

  var getTileTargetPositionByIndex =
      getTileTargetPositionInTileset(tilesetSizeInTiles);
  var copyTileIntoCorrespodingPositionInTilesetImage = (tile, index) => {
    var tilePositionInTilesetImage = getTileTargetPositionByIndex(index);
    console.log('-------- copying tile ' + index + ',' + tilePositionInTilesetImage + '..' + tilesetSizeInTiles);
    copyTile(tilesetImage, tile, tilePositionInTilesetImage);
  };
  _.map(tilesetData.tiles, copyTileIntoCorrespodingPositionInTilesetImage);
  return writeTilesetImage(tilesetImageFilename, tilesetImage);
}

/**
 *
 *
 * @param {Object} tilesetData -
 * @param {number} mapWidthTiles - the horizontal size of the map in tile units
 * @param {number} mapHeightTiles - the vertical size of the map in tile units
 * @param {number} tileWidthPixels - the width of a tile in pixels
 * @param {number} tileHeightPixels - the height a tile in pixels
 *
 */
function writeTmxFile(tilesetData, mapWidthTiles, mapHeightTiles,
      tileWidthPixels, tileHeightPixels) {
  var tilesetWidthTiles = 1;
  var tilesetHeightTiles = 1;
  var tmxMapVersion = '1.0';
  var mapOrientation = 'orthogonal';
  var layerName = 'layer';
  var tilesetName = layerName;
  var tilesetImageSource = layerName + '-Tileset.png';
  var tilesetWidthPixels = tilesetWidthTiles * tileWidthPixels;
  var tilesetHeightPixels = tilesetHeightTiles * tileHeightPixels;

  var tmxOutputFile = new XmlWriter(function (el) {
    el('map', function (el, at) {
      at('version', tmxMapVersion);
      at('orientation', mapOrientation);
      at('width', mapWidthTiles);
      at('height', mapHeightTiles);
      at('tilewidth', tileWidthPixels);
      at('tileheight', tileHeightPixels);
      el('tileset', function (el, at) {
        at('firstgid', 'test.png');
        at('name', tilesetName);
        at('tilewidth', tileWidthPixels);
        at('tileheight', tileHeightPixels);
        el('image', function (el, at) {
          at('source', tilesetImageSource);
          at('width', tilesetWidthPixels);
          at('height', tilesetHeightPixels);
        })
      });
      el('layer', function (el, at) {
        at('name', layerName);
        at('width', mapWidthTiles);
        at('height', mapHeightTiles);
        el('data', function (el, at) {
          at('encoding', 'base64');
          at('compression', 'test.png');
        })
      });
    });
  }, { addDeclaration : true });

  console.log('*****' + tmxOutputFile);
  /*
  var gaita = '<?xml version="1.0" encoding="UTF-8"?>\n' +
       '<map version="1.0" orientation="orthogonal" width="' + gridWidth + '" height="' + gridHeight + '" tilewidth="' + tileWidth + '" tileheight="' + tileHeight + '">\n' +
       ' <tileset firstgid="1" name="' + fbase + '" tilewidth="' + tileWidth + '" tileheight="' + tileHeight + '">\n' +
       '  <image source="' + fbase + '-Tileset.png" width="' + gridWidth * tileWidth + '" height="' + gridHeight * tileHeight + '"/>\n' +
       ' </tileset>\n' +
       ' <layer name="' + fbase + '" width="' + gridWidth + '" height="' + gridHeight + '">\n' +
       '  <data encoding="' + (arguments[1] ? arguments[1] : 'base64') + '"' + (comp ? ' compression="' + comp + '"' : '') + '>\n' +
       '   ' + arguments[0] + '\n' +
       '  </data>\n' +
       ' </layer>\n' +
       '</map>\n';
   */
}

module.exports = {
  getTileTopLeftCoordinates: getTileTopLeftCoordinates,
  tilesetFromImage : tilesetFromImage,
  maybeAddTileInCoordinates : maybeAddTileInCoordinates,
  writeTmxFile : writeTmxFile,
  getTilesetImageSizeInTiles : getTilesetImageSizeInTiles,
  writeTilesetImage : writeTilesetImage,
  buildTilesetImage : buildTilesetImage,
  getTileTargetPositionInTileset : getTileTargetPositionInTileset,
};
