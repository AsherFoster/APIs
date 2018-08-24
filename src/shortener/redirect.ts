import * as mongoose from 'mongoose';

export const redirectSchema = new mongoose.Schema({
  action: {
    destination: String
  },
  created: Date,
  creator: String,
  id: {
    index: {
      dropDups: true,
      unique: true
    },
    type: String
  },
  type: String,
  updated: Date,
  updater: String
});

export const Redirect = mongoose.model<Redirect>('Redirect', redirectSchema);

export interface Redirect extends mongoose.Document {
  action: {
    destination: string
  };
  created: Date;
  creator: string;
  id: string;
  type: string;
  updated?: string;
  updater?: string;
}

export default Redirect;
