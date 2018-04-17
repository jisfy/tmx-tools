
var XmlWriter = require('simple-xml-writer').XmlWriter;
var Jimp = require('jimp');
var _ = require('underscore');
var Q = require('q');

/**
 * A TiledMap class
 * @constructor
 * @param {string} name - the TiledMap name
 */
function TiledMap(name) {
  this.name = name;
}

TiledMap.prototype.sayHello = function () {
  console.log(' Hello ' + this.name);
};

var tileMap = new TiledMap('Cowboys vs Ninjas');
tileMap.sayHello();

var tmxOutputFile = new XmlWriter(function (el) {
  el('tmx-file', function (el, at) {
    el('tile-set', function (el, at) {
      at('name', 'test.png');
    }); 
  });
}, { addDeclaration : true });

console.log('data ' + tmxOutputFile.toString());

/**
 * Generates a list of pairs holding the top-left coordinates for each tile candidate
 * in the source image
 *
 * @param {number} imageWidth - the source image width in pixels
 * @param {number} imageHeight - the source image height in pixels
 * @param {number} tileWidth - the tile width in pixels
 * @param {number} tileHeight - the tile height in pixels
 * @return {Array<Array<number, number>>} a list of pairs holding the top-left coordinates
 *     for each tile candidate in the source image
 * @throws {Error} in case the imageWidth is not divisible by the tileWidth, or the 
 *     imageHeight is not divisible by the tileHeight
 */
function getTileTopLeftCoordinates(imageWidth, imageHeight, tileWidth, tileHeight) {
  var imageWidthInTiles = imageWidth / tileWidth;
  var imageHeightInTiles = imageHeight / tileHeight;
  var isNonMultipleHorizontal = (imageWidth % tileWidth != 0);
  var isNonMultipleVertical = (imageHeight % tileHeight != 0);
  if (isNonMultipleHorizontal || isNonMultipleVertical) {
    throw new Error('Can not generate Tile coordinates with image size non divisible by tile size ');
  }
  var tileHorizontalIndexes = _.range(imageWidthInTiles);
  var tileVerticalIndexes = _.range(imageHeightInTiles);
  var getIndexPairsForRow = (horizontalIndex => (
      tileVerticalIndexes.map(verticalIndex => [horizontalIndex, verticalIndex])));   
  var tileTopLeftCoordinates = _.chain(tileHorizontalIndexes).map(getIndexPairsForRow).
      flatten(true).value();
  return tileTopLeftCoordinates;
}

/**
 * Creates a TileSet from an Image
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
    var tileAtIndex = buildTileImage(image, topLeftTileCoordinates, tileWidth, tileHeight);
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
  var tilesetDataWholeImage$ = _.reduce(tileTopLeftCoordinates, addTiles, tilesetDataSoFar$);

  return tilesetDataWholeImage$;
}

/**
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
 * Builds a Closure over a Tile, and its index position in the source image, which
 * will then add it to the Tile Set if not already present 
 * 
 * @param {number} tileIndexLeft - the horizontal index the Tile occupies in 
 *     the source image
 * @param {number} tileIndexTop - the vertical index the Tile occupies in the
 *     source image
 * @param {Jimp} tile - the Tile bitmap to add to the Tile Set
 * @return {function} - A function (tilesetData, tileBase64) => Promise(tilesetData)
 *     that will add the given Tile at position tileIndexLeft, tileIndexTop to the
 *     given Tile Set if its Base64 encoding is not already present.
 */
function maybeAddTileInCoordinates(tileIndexLeft, tileIndexTop, tile) {
  var maybeAddTileInCoordinatesAsync = function (tilesetData, tileBase64) {
      var isTileBase64InTileset = tileBase64 in tilesetData.tileMapping;
      if (!isTileBase64InTileset) {
        tilesetData.tiles.push(tile); 
        if (tilesetData.mapping[tileIndexLeft] === undefined) {
          tilesetData.mapping[tileIndexLeft] = [];
        }
        tilesetData.mapping[tileIndexLeft][tileIndexTop] = 
            tilesetData.tiles.length;
        tilesetData.tileMapping[tileBase64] = tilesetData.tiles.length;
      }
      return Q(tilesetData);
  };
  return maybeAddTileInCoordinatesAsync;
}

module.exports = {
  getTileTopLeftCoordinates: getTileTopLeftCoordinates,
  tilesetFromImage : tilesetFromImage,
};
