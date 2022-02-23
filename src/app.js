const express = require("express");
const bodyParser = require("body-parser");
const { sequelize, Contract, Profile, Job } = require("./model");
const { getProfile } = require("./middleware/getProfile");
const { Op, QueryTypes } = require("sequelize");
const moment = require("moment");
const balanceInquiry = require("./middleware/balanceInquiry");
const depositPercentageValidator = require("./middleware/depositPercentageValidator");
const app = express();
app.use(bodyParser.json());
app.set("sequelize", sequelize);
app.set("models", sequelize.models);

/**
 * @returns contract by id
 */
app.get("/contracts/:id", getProfile, async (req, res) => {
  try {
    const { Contract } = req.app.get("models");
    const { id } = req.params;
    const contract = await Contract.findOne({
      where: {
        ClientId: {
          [Op.eq]: id,
        },
      },
    });
    if (!contract) {
      throw new Error("No Contract Found!");
    }
    res.json({
      createdAt: new Date(),
      message: "Contracts for the user are retrieved",
      data: contract,
    });
  } catch (err) {
    res
      .status(404)
      .send({
        createdAt: new Date(),
        message: err.message,
      })
      .end();
  }
});

/**
 * @returns all contracts which are not terminated
 */

app.get("/contracts", async (req, res) => {
  try {
    const { Contract } = req.app.get("models");
    const contracts = await Contract.findAll({
      where: {
        status: {
          [Op.not]: "terminated",
        },
      },
    });

    res.json({
      createdAt: new Date(),
      message: "All Contracts Retreived",
      data: contracts,
    });
  } catch (err) {
    res
      .status(404)
      .send({
        createdAt: new Date(),
        message: err,
      })
      .end();
  }
});

/**
 * @returns all unpaid jobs
 */

app.get("/jobs/unpaid", async (req, res) => {
  try {
    const { Job, Contract } = req.app.get("models");
    const jobs = await Job.findAll({
      include: [
        {
          model: Contract,
          where: {
            status: {
              [Op.eq]: "in_progress",
            },
          },
        },
      ],
      where: {
        paid: {
          [Op.eq]: null,
        },
      },
    });
    res.json({
      createdAt: new Date(),
      message: "All Unpaid Jobs Retreived",
      data: jobs,
    });
  } catch (err) {
    console.log(err);
  }
});

/**
 * @returns Message
 */
app.post("/jobs/:job_id/pay", balanceInquiry, async (req, res) => {
  try {
    let client = req.profile;
    let contractor = req.contractor;
    let job = req.job;
    await Profile.update(
      { balance: client.balance - job.price },
      { where: { id: client.id } }
    );
    await Profile.update(
      { balance: contractor.balance + job.price },
      { where: { id: contractor.id } }
    );
    await Job.update(
      { paid: true, paymentDate: new Date() },
      { where: { id: job.id } }
    );
    res.json({
      status: true,
      message: "Client has Paid the Price for the Contract!",
    });
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: err.message });
  }
});

/**
 * Note:
 * Percentage to deposit must be given in the body so the amount of all the job will be add
 * {
 *   depositPercentage:25 i.e min 1 ,max 25, default 25
 * }
 *  @returns Message
 */

app.post(
  "/balances/deposit/:userId",
  depositPercentageValidator,
  async (req, res) => {
    try {
      console.log(req.depositPercentage);
      let depositPercentage = req.depositPercentage.value;
      let Job = await sequelize.query(
        `SELECT * FROM jobs WHERE ContractId IN (SELECT id FROM contracts WHERE ClientId =${req.params.userId} )`,
        {
          type: QueryTypes.SELECT,
        }
      );
      let totalJobsPrice = 0;
      Job.map((item) => (totalJobsPrice = totalJobsPrice + item.price));
      console.log(
        totalJobsPrice,
        depositPercentage,
        totalJobsPrice * (depositPercentage / 100),
        depositPercentage / 100
      );
      let newAddedAmount = totalJobsPrice * (depositPercentage / 100);
      await Profile.update(
        { balance: sequelize.literal(`balance + ${newAddedAmount}`) },
        { where: { id: req.params.userId } }
      );
      res.json({
        status: true,
        message: `Amount is Deposited at ${
          req.depositPercentage.isDefault ? "Default" : ""
        } Percentage of ${
          req.depositPercentage.isDefault ? "25%" : `${depositPercentage}%`
        }`,
      });
    } catch (err) {
      console.log(err);
      res.status(400).send({ error: err.message });
    }
  }
);

/**
 * Note Start and End date must be as following
 * start=2020-08-16T19:11:26.737Z
 * end=2020-08-22T19:11:26.737Z
 *  @returns All Best Profession
 */
app.get("/admin/best-profession", async (req, res) => {
  try {
    let { start, end } = req.query;
    console.log(start, end);
    const jobs = await sequelize.query(
      `SELECT
       profiles.profession as Profession,
       (select SUM(price) from jobs
        where jobs.ContractId in
       (select id from contracts where ContractorId=profiles.id)) as paid
       FROM profiles
       INNER JOIN contracts
       ON profiles.id=contracts.ContractorId
       INNER JOIN jobs
       ON contracts.id=jobs.ContractId
       WHERE 
       profiles.type='contractor' AND 
       jobs.paid=true AND
       jobs.paymentDate BETWEEN date('${start}') AND date('${end}')
       GROUP BY profiles.profession`,
      {
        type: QueryTypes.SELECT,
      }
    );
    res.json({
      createdAt: new Date(),
      message: "All Jobs " + jobs.length,
      data: jobs,
    });
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: err.message });
  }
});
/**
 * Note Start and End date must be as following
 * start=2020-08-16T19:11:26.737Z
 * end=2020-08-22T19:11:26.737Z
 * limit default =2
 *  @returns All Best Profession
 */
app.get("/admin/best-clients", async (req, res) => {
  try {
    let { start, end, limit } = req.query;
    if (!limit) {
      limit = 2;
    }
    console.log(start, end, limit);
    const jobs = await sequelize.query(
      `SELECT
       profiles.id as id,
       profiles.firstName || ' ' || profiles.lastName as fullName,
       (select SUM(price) from jobs
        where jobs.ContractId in
       (select id from contracts where ContractorId=profiles.id)) as paid
       FROM profiles
       INNER JOIN contracts
       ON profiles.id=contracts.ContractorId
       INNER JOIN jobs
       ON contracts.id=jobs.ContractId
       WHERE jobs.paid=true
       GROUP BY profiles.id
       LIMIT ${limit}
       `,
      {
        type: QueryTypes.SELECT,
      }
    );
    res.json({
      createdAt: new Date(),
      message: "All Jobs " + jobs.length,
      data: jobs,
    });
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: err.message });
  }
});

module.exports = app;
