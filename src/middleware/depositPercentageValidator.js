const { Job, Contract, Profile } = require("../model");
const { Op } = require("sequelize");
module.exports = async (req, res, next) => {
  try {
    let depositPercentage = req.body.depositPercentage;
    if (depositPercentage === undefined) {
      req.depositPercentage = {
        isDefault: true,
        value: 25,
      };
      next();
    } else if (depositPercentage > 25 || depositPercentage <= 0) {
      res.status(401).send({
        error: "Invalid Deposit",
        message: "Deposit percentage must be between 1-25",
      });
    } else if (depositPercentage >= 1 && depositPercentage < 26) {
      req.depositPercentage = {
        isDefault: false,
        value: depositPercentage,
      };
      next();
    }
  } catch (err) {
    res.status(401).send({ error: err.message });
  }
};
