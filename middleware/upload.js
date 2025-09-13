// middleware/upload.js
const multer = require('multer');

// Usamos memoryStorage para obtener buffer en req.file.buffer (necesario para Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ext = file.mimetype;
    if (allowed.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Formato de imagen no válido. Solo jpg, jpeg o png.'), false);
    }
};

const limits = {
    fileSize: 5 * 1024 * 1024 // 5 MB máximo por archivo
};

const upload = multer({ storage, fileFilter, limits });

module.exports = upload;
