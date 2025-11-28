import { Schema as _Schema, model } from 'mongoose';
const Schema = _Schema;

const zoneSchema = new Schema({
    name: { type: String, required: true, unique: true },
    geometry: {
        type: {
            type: String,
            enum: ['Polygon'],
            required: true
        },
        coordinates: {
            type: [[[Number]]],
            required: true
        }
    }
}, { timestamps: true });

zoneSchema.index({ geometry: '2dsphere' });

const Zone = model('Zone', zoneSchema);
export default Zone;