import { Schema as _Schema, model } from 'mongoose';
const Schema = _Schema;

const departmentSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    zone: {
        type: Schema.Types.ObjectId,
        ref: 'Zone',
        required: true
    },
    subhead: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    categories: {
        type: [String],
        default: []
    },
    budget: {
        total: { type: Number, default: 0 },
        spent: { type: Number, default: 0 },
    }
}, { timestamps: true });

departmentSchema.index({ location: '2dsphere' });

const Department = model('Department', departmentSchema);
export default Department;