import { DataTypes } from "sequelize";
import { sequelize } from "../sequelize.js";

export const GoogleToken = sequelize.define("GoogleToken", {
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    primaryKey: true,
  },
  accessToken: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true, // allow null because Google may not send it
  },
  scope: {
    type: DataTypes.STRING,
  },
  tokenType: {
    type: DataTypes.STRING,
  },
  expiryDate: {
    type: DataTypes.BIGINT, // store as milliseconds
    allowNull: true,
  },
}, {
  tableName: "GoogleTokens",
  timestamps: true,
});
