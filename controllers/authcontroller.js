import {User} from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";

export const register = async (req, res) => {
  const { id, name, email, password, role } = req.body;

  // console.log("req: ", req.body);
  // console.log("res: ", res.body);

  const userExists = await User.findOne({ email });
  if (userExists)
    return res.status(400).json({ message: "User already exists" });

  const user = await User.create({ id, name, email, password, role });

  res.status(201).json({
    _id: user._id,
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user),
  });

  console.log(res);
};


export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    res.json({user:{
      _id: user._id,
      id:user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },token: generateToken(user)});
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
};
