const multer = require('multer');
const path = require('path');

// Configurar almacenamiento en memoria
const storage = multer.memoryStorage();

// Validar tipo de archivo
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (JPEG, JPG, PNG, WEBP)'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // Límite de 5MB
    }
});

module.exports = upload;