import { DataTypes } from "sequelize";
import { sequelize } from "../sequelize.js";

const GoogleAccount = sequelize.define(
  "GoogleAccount",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    email: DataTypes.STRING,
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    scope: DataTypes.TEXT,
    expiry: DataTypes.DATE,
  },
  {
    tableName: "google_accounts",
    timestamps: true,
    underscored: true,
  }
);

export default GoogleAccount;
