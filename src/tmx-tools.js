
var _ = require('underscore');
var XmlWriter = require('simple-xml-writer').XmlWriter;
var Jimp = require('jimp');
// var argv = require('optimist').usage('Usage : $0 -s tile_size -i input_bitmap.png -o output_tilemap.tmx').demand(['s','i', 'o']).argv;
var argv = require('optimist').usage('Usage : $0 -s tile_size -i input_bitmap.png -o output_tilemap.tmx').argv;
var Q = require('q');

var inputBitmapFileName = argv.i;
var outputTileMapFileName = argv.o;
var tileWidth = argv.s;
var tileHeight = argv.s;

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
function tilesetFromImage(image, tileTopLeftCoordinates) {
  var emptyTilesetData = {
    mapping : [],
    tiles: [],
    tileMapping : {},
  };
  
  var imageWidthInTiles = image.width / tileWidth;
  var imageHeightInTiles = image.height / tileHeight;

  var addTiles = function (tilesetData$, topLeftTileCoordinates) {
    var tileAtIndex = new Jimp(tileWidth, tileHeight);
    var tileTargetHorizontalPosition = 0;
    var tileTargetVerticalPosition = 0;  
    var sourceImageHorizontalPosition = topLeftTileCoordinates[0] * tileWidth;
    var sourceImageVerticalPosition = topLeftTileCoordinates[1] * tileHeight;

    tileAtIndex.blit(image, 
        tileTargetHorizontalPosition, 
        tileTargetVerticalPosition, 
        sourceImageHorizontalPosition, 
        sourceImageVerticalPosition, 
        tileWidth,
        tileHeight);

    var tileAtIndexBase64$ = Q.ninvoke(tileAtIndex, 'getBase64', Jimp.AUTO);
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
