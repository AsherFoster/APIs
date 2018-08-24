import * as mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

export const userSchema = new mongoose.Schema({
  created: Date,
  email: String,
  firstJwt: {type: Date, default: () => Date()},
  id: String,
  lastLogin: Date,
  name: String,
  password: String
});

userSchema.methods.publicUser = function(): PublicUser {
  return {
    created: this.created,
    email: this.email,
    id: this.id,
    lastLogin: this.lastLogin,
    name: this.name
  };
};

userSchema.methods.checkPassword = async function(password: string): Promise<boolean> {
  return await bcrypt.compare(password, this.password);
};

export const User = mongoose.model<User>('User', userSchema);

export interface User extends mongoose.Document {
  created: Date;
  email: string;
  firstJwt: Date;
  id: string;
  lastLogin: Date;
  name: string;
  password: string;
  publicUser: () => PublicUser;
  checkPassword: (password: string) => Promise<boolean>;
}

interface PublicUser {
  created: Date;
  email: string;
  id: string;
  lastLogin?: Date;
  name: string;
}

export default User;
