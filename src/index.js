
var tmxTools = require('./tmx-tools');
var _ = require('underscore');
var Q = require('q');
var Jimp = require('jimp');

var optionDescriptions = {
  i : 'sets the source bitmap image to the given filename',
  o : 'sets the output tmx filename to the given filename',
  s : 'sets the target tile size in pixels. Tiles are square',
  z : 'sets the compression for the Layer Data (gzip, zlib, none)'
};

var defaultOptionValues = {
  s : 64,
  z : 'gzip',
};

var argv = require('optimist').usage('\n Converts a bitmap image into a ' +
    'TileMap (.tmx) file \n Usage : $0 -s [tile_size_pixels] ' +
        '-i [input_bitmap] -o [output_tilemap]').describe(optionDescriptions).
            default(defaultOptionValues).wrap(80).check(areArgumentsValid).
                demand(['i', 'o']).argv;


/**
 * Checks that the -s argument passed in the command line is valid
 *
 * @throws {Error} - In case the argument's value is not a non zero, non
 *     positive integer and a power of two, and is therefore considered
 *     invalid
 */
function isSArgumentValid(sArgumentValue) {
  if (sArgumentValue != undefined) {
    var isSNumber = Number.isInteger(sArgumentValue);
    var isSPowerOfTwo = false;
    var isSPositive = sArgumentValue > 0;
    if (isSNumber) {
      var sArgumentValueLog = Math.log2(sArgumentValue);
      isSPowerOfTwo = Number.isInteger(sArgumentValueLog);
    }
    var isSArgumentValid = isSNumber && isSPositive && isSPowerOfTwo;
    if (!isSArgumentValid) {
      throw new Error('the Tile size must be a positive integer and a power of two');
    }
  }
}

function isZArgumentValid(zArgumentValue) {
  if (zArgumentValue != undefined) {
    var isZGzip = ('gzip' === zArgumentValue);
    var isZZlib = ('zlib' === zArgumentValue);
    var isZNone = ('none' === zArgumentValue);
    var zArgumentValueValid = isZGzip || isZZlib || isZNone;
    if (!zArgumentValueValid) {
      throw new Error('the compression algorithm must be (gzip | zlib | none)');
    }
  }
}

/**
 * Checks that all arguments passed in the command line are valid
 * @throws {Error} - In case one of the arguments passed from the command line
 *     is not valid
 */
function areArgumentsValid(argv) {
  isSArgumentValid(argv.s);
  isZArgumentValid(argv.z);
}

/**
 * Writes all Tiles in a Tile Set as individual images to the filesystem.
 * Used for debugging
 *
 * @param {string} path - path to the directory where tiles will be written
 * @param {Object} tileset - object holding the tile images to be written
 */
function dumpTiles(path, tileset) {
  var tileId = 0;
  _.each(tileset.tiles, x => {
    var tilePath = path + "/tile_" + tileId + ".png";
    console.log("writing " + tilePath);
    tileId++;
    x.write(tilePath);
  });
}

var inputBitmapFileName = argv.i;
var outputTileMapFileName = argv.o;
var tileWidth = argv.s;
var tileHeight = argv.s;
var compressionAlgorithm = argv.z;

Jimp.read(inputBitmapFileName).then(function (image) {
  var tileTopLeftCoordinates = tmxTools.getTileTopLeftCoordinates(
      image.bitmap.width,
      image.bitmap.height,
      tileWidth,
      tileHeight
  );
  var tileset$ = tmxTools.tilesetFromImage(
      image,
      tileTopLeftCoordinates,
      tileWidth,
      tileHeight
  );
  tileset$.then(function (tileset) {
    // dumpTiles('./tiles', tileset);
    var mapWidthInTiles = Math.floor(image.bitmap.width / tileWidth);
    var mapHeightInTiles = Math.floor(image.bitmap.height / tileHeight);
    var writeTmxFile$ = tmxTools.writeTmxFile(
        outputTileMapFileName,
        tileset,
        [mapWidthInTiles, mapHeightInTiles],
        [tileWidth, tileHeight],
        compressionAlgorithm,
    );
    return writeTmxFile$
  });
  return tileset$;
}).then(function (tmxFile) {
  console.log('TileMap successfully generated at ' + outputTileMapFileName);
}).catch(function (err) {
  console.log('Couldnt perform conversion succesfully ' + err.message);
});
