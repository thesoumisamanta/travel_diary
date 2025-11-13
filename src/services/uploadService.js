import fs from 'fs';
import path from 'path';
import { cloudinary, initCloudinary } from '../config/cloudinary.js';


export const uploadToCloudinary = async (buffer, filename, folder = 'youtube') => {
    if (!process.env.CLOUDINARY_API_KEY) {
        throw new Error('Cloudinary not configured');
    }
    // Cloudinary accepts streams or base64; buffer -> base64
    const base64 = buffer.toString('base64');
    const dataUri = `data:application/octet-stream;base64,${base64}`;
    const result = await cloudinary.uploader.upload(dataUri, {
        resource_type: 'auto',
        folder,
        public_id: path.parse(filename).name,
        use_filename: true,
        unique_filename: false,
        overwrite: false
    });
    return result;
};

export const saveLocally = async (buffer, filename, destFolder = 'public/uploads') => {
    await fs.promises.mkdir(destFolder, { recursive: true });
    const filepath = path.join(destFolder, filename);
    await fs.promises.writeFile(filepath, buffer);
    return { url: `/${filepath}` };
};

// export default { uploadToCloudinary, saveLocally };
