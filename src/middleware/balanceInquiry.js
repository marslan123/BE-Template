const { Job, Contract, Profile } = require("../model");
module.exports = async (req, res, next) => {
  try {
    let job = await Job.findOne({
      where: {
        id: req.params.job_id,
      },
    });
    job = await job.toJSON();
    console.log("job", job);
    if (job.paid) {
      return res.status(400).send({
        error: "Invalid Payment",
        message: "Job has already been Paid!",
      });
    }
    let contract = await Contract.findOne({
      where: {
        id: job.ContractId,
      },
    });
    contract = await contract.toJSON();
    console.log("contract", contract);
    let profile = await Profile.findOne({
      where: {
        id: contract.ClientId,
      },
    });
    profile = await profile.toJSON();
    console.log("client", profile);
    if (profile.balance < job.price)
      return res.status(400).send({
        error: "Insufficient Balance",
      });
    let contractor = await Profile.findOne({
      where: {
        id: contract.ContractorId,
      },
    });
    contractor = await contractor.toJSON();
    console.log("contractor", contractor);
    req.profile = profile;
    req.job = job;
    req.contract = contract;
    req.contractor = contractor;
    next();
  } catch (err) {
    res.status(401).send({ error: err.message });
  }
};
