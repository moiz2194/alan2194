const express = require('express')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const router = express.Router();
const cron = require('node-cron');
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
router.use(express.json());
const UserModel = require('../Database/UserSchema');
const stripe = require('stripe')("sk_test_51MhEx6AM71JH6IUZOwPEgMhLinzLJG5qvQVBzxWkcBA05EE8VuCvcUZ7NVqZ1q6AAN34Ol1x1FpSWUZgT51WVmCs00DpF3dKzS");
//NEW
const QueriesModel = require('../Database/QueriesSchema')
const NotifyModel = require('../Database/NotifySchema');
const CouponModel = require('../Database/CouponSchema');
const ProfitDetailModel = require('../Database/ProfitDetail')
const ProductModel = require('../Database/ProductSchema');
const Authentication = require('../pages/Authentication');
//Nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'xyzafaq@gmail.com',
      pass: 'zkhqrvteqqandxtj'
    }
});
// Runs every day at midnight
cron.schedule('0 0 * * *', async () => {
    const currentDate = new Date();
    const expiredMembers = await UserModel.updateMany({
      membership: { $in: ['investor', 'founder'] },
      membershipValid: { $lt: currentDate },
    }, { $set: { membership: "none" } });
    //   const currentDate = new Date();
//   const expiredUsers = await UserModel.find({
//     membership: 'investor',
//     membershipValid: { $lt: currentDate },
//   });

//   if (expiredUsers.length > 0) {
//     await UserModel.updateMany(
//       { _id: { $in: expiredUsers.map((user) => user._id) } },
//       { $set: { membership: "none" } }
//     );
//   }
});
// */5 * * * *
cron.schedule('*/5 * * * *', async () => {
    console.log("30 Sec Passed");
    const profitPlans = await UserModel.find(
      { planHistory: { $ne: [] } },{ planHistory: 1, disponible: 1,name: 1, membership:1 });
    // console.log(profitPlans);
    for (const profitPlan of profitPlans) {
      for (const planHist of profitPlan.planHistory) {
        if(profitPlan.disponible===null){
              const result = await UserModel.updateOne({_id: profitPlan._id},{$set:{disponible:0}});
            }
        if (planHist.planName === 'Profit Plan Pro' && (profitPlan.membership==='investor' || profitPlan.membership==='founder')){
            console.log("Profit Plan Pro");
            console.log(profitPlan.membership);
            const updatedDate = new Date(planHist.updatedDate); // Last profit updated date
            // console.log(updatedDate);
            const today = new Date();
            // console.log(today);
            const timeDiff = today.getTime() - updatedDate.getTime(); // difference in milliseconds
            const daysDiff = timeDiff / (1000 * 3600 * 24); // convert to days
            // console.log(daysDiff);
            if (daysDiff >= 0) {
                console.log('30 days have passed since the last update');
                const updateddate = await UserModel.findOneAndUpdate(
                    { _id: profitPlan._id, 'planHistory._id': planHist._id },
                    { $set: { 'planHistory.$.updatedDate': today } }
                )
                // const result2 = await UserModel.updateOne({ _id: profitPlan._id },{$push: {'planHistory.$[plan].profitHistory': {$each: [{month: new Date(),profit: increment}],$position: 0}}},{arrayFilters: [{'plan.planName': 'Profit Plan Pro'}],new: true}).exec();
                const increment = planHist.amount * 0.03; 
                const result = await UserModel.findOneAndUpdate(
                    { _id: profitPlan._id, 
                      'planHistory._id': planHist._id },
                    { 
                      $inc: { 
                        disponible: increment,
                        totalbalance: increment,
                        'planHistory.$.profit': increment
                        },
                      $push: { 
                        'planHistory.$.profitHistory': {
                          from: updatedDate,
                          to: today,
                          profit: increment
                        } }},{ new: true });
                console.log(`Updated disponible for user ${result.name} to ${result.disponible}`);
                const profitNotify = ProfitDetailModel({email:result.email,from:updatedDate,to:today,profit:increment,planName:'Profit Plan Pro'});
                const saveprofitNotify = await profitNotify.save();
                let htmlString = `
                <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                        <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                        <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Monthly Profit added for <span style="color: #0a960a;">${planHist.planName}</span></h1>
                        <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${result.name}</span>,</p>
                        <p>
                            <span style="color: #0a960a;font-weight:600;">Congrats!</span>
                            We have added <span style="color: #0a960a;font-weight:600;">$${increment}</span>
                             monthly profit of your 
                              <span style="color: #0a960a;font-weight:600;">${planHist.planName}</span>
                               on <span style="font-weight:600;" >
                                        ${new Date(today).toLocaleString('en-US', { day: 'numeric', month: 'long',year: 'numeric' })}
                                    </span> . Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Plan amount:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${planHist.amount} MX</div>
                            </div>
                        </div> 
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Added profit:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${increment} MX</div>
                            </div>
                        </div> 
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Total profit:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${planHist.profit+increment} MX</div>
                            </div>
                        </div> 
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Plan purchased on:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">${new Date(planHist.date).toLocaleString('en-US', { day: 'numeric', month: 'long',year: 'numeric' })}</div>
                            </div>
                        </div>
                        <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                        <p>Thank you once again for your business!</p>
                        <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                    </div>
                </div>
                `;
                const mailOptions = {
                    from: 'xyzafaq@gmail.com',
                    to: result.email,
                    subject: `Monthly Profit $${increment} MX added Successfully!`,
                    html: htmlString
                };
                transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                    console.log(error);
                    } else {
                    console.log('Email sent: ' + info.response);
                    }
                });
            } else {
              console.log('Less than 30 days');
            }
        }
        if (planHist.planName === 'Profit Plan Premium' && (profitPlan.membership==='investor' || profitPlan.membership==='founder')) {
            console.log("Profit Plan Premium");
            const updatedDate = new Date(planHist.updatedDate); // Last profit updated date
            // console.log(updatedDate);
            const today = new Date();
            // console.log(today);
            const timeDiff = today.getTime() - updatedDate.getTime(); // difference in milliseconds
            const daysDiff = timeDiff / (1000 * 3600 * 24); // convert to days
            console.log(daysDiff);
            if (daysDiff >= 0) {
                // console.log('30 days have passed since the last update');
                const updateddate = await UserModel.findOneAndUpdate(
                    { _id: profitPlan._id, 'planHistory._id': planHist._id },
                    { $set: { 'planHistory.$.updatedDate': today } }
                )
                // const result2 = await UserModel.updateOne({ _id: profitPlan._id },{$push: {'planHistory.$[plan].profitHistory': {$each: [{month: new Date(),profit: increment}],$position: 0}}},{arrayFilters: [{'plan.planName': 'Profit Plan Pro'}],new: true}).exec();
                const increment = planHist.amount * 0.04; 
                const result = await UserModel.findOneAndUpdate(
                    { _id: profitPlan._id, 
                      'planHistory._id': planHist._id },
                    { 
                    $inc: { 
                        disponible: increment,
                        totalbalance: increment,
                        'planHistory.$.profit': increment
                    },
                      $push: { 
                        'planHistory.$.profitHistory': {
                          from: updatedDate,
                          to: today,
                          profit: increment
                        } }},{ new: true });                                   
                // console.log(updateddate);
                // const result = await UserModel.findOneAndUpdate(
                //     { _id: profitPlan._id },{ 
                //         $inc: { disponible: increment }
                //     },
                //     { new: true });
                console.log(`Updated disponible for user ${result.name} to ${result.disponible}`);
                const profitNotify = ProfitDetailModel({email:result.email,from:updatedDate,to:today,profit:increment,planName:'Profit Plan Premium'});
                const saveprofitNotify = await profitNotify.save();
                let htmlString = `
                <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                        <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                        <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Monthly Profit added for <span style="color: #0a960a;">${planHist.planName}</span></h1>
                        <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${result.name}</span>,</p>
                        <p>
                            <span style="color: #0a960a;font-weight:600;">Congrats!</span>
                            We have added <span style="color: #0a960a;font-weight:600;">$${increment}</span>
                             monthly profit of your 
                              <span style="color: #0a960a;font-weight:600;">${planHist.planName}</span>
                               on <span style="font-weight:600;" >
                                        ${new Date(today).toLocaleString('en-US', { day: 'numeric', month: 'long',year: 'numeric' })}
                                    </span> . Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Plan amount:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${planHist.amount} MX</div>
                            </div>
                        </div> 
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Added profit:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${increment} MX</div>
                            </div>
                        </div> 
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Total profit:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${planHist.profit+increment} MX</div>
                            </div>
                        </div> 
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Plan purchased on:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">${new Date(planHist.date).toLocaleString('en-US', { day: 'numeric', month: 'long',year: 'numeric' })}</div>
                            </div>
                        </div>
                        <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                        <p>Thank you once again for your business!</p>
                        <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                    </div>
                </div>
                `;
                const mailOptions = {
                    from: 'xyzafaq@gmail.com',
                    to: result.email,
                    subject: `Monthly Profit $${increment} MX added Successfully!`,
                    html: htmlString
                };
                transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                    console.log(error);
                    } else {
                    console.log('Email sent: ' + info.response);
                    }
                });
            } else {
              console.log('Less than 30 days');
            }
        }
      }
    }
});
router.post('/api/paymentPro/:id', async (req, res) => {
    try {
        // console.log(req.body)
      const { amount, currency, token } = req.body;
      const charge = await stripe.charges.create({
        amount,
        currency,
        source: token,
        description: 'Profit Plan Pro'
      });
      if (charge.status === 'succeeded') {
        console.log("SUCCESS");
        res.send({msg:"Payment successful"});
        // Save Payment info in user planHistory ARRAYs
        const contractNumber = Date.now().toString().substring(6) + Math.floor(Math.random() * 100000000).toString().substring(0,7);
        const result = await UserModel.updateOne(
            { _id: req.params.id },
            { $push: {
                planHistory: {
                  $each: [{
                    transaction_id: charge.transaction_id,
                    amount: charge.amount/100,
                    contractNumber: contractNumber,
                    profit:0,
                    amount_captured: charge.amount_captured/100,
                    name: charge.billing_details.name,
                    captured: charge.captured,
                    created: charge.created,
                    currency: charge.currency,
                    description: charge.description,
                    planName: charge.description,
                    paid: charge.paid,
                    brand: charge.payment_method_details.card.brand,
                    country: charge.payment_method_details.card.country,
                    exp_month: charge.payment_method_details.card.exp_month,
                    exp_year: charge.payment_method_details.card.exp_year,
                    funding: charge.payment_method_details.card.funding,
                    last4: charge.payment_method_details.card.last4,
                    network: charge.payment_method_details.card.network,
                    receipt_url: charge.receipt_url,
                    status: charge.status,
                  }],
                  $position: 0
                }
            }}
          );
        if(result){
            // const currentDate = new Date();
            // const membershipValid = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
            // const result = await UserModel.updateOne({_id:req.params.id},{ $set:{membership:'investor',membershipValid}});
            const result1 = await UserModel.findOne({_id:req.params.id},{totalbalance:1});
            const result2 = await UserModel.updateOne({_id:req.params.id},{ $set:{totalbalance: result1.totalbalance + (charge.amount/100),profit:0 }});
            console.log(result);
            const userData = await UserModel.find({_id:req.params.id},{name:1,email:1});
            // console.log(userData[0].name);            
            // console.log(userData[0].email);
            let htmlString = `
                <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                        <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                        <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Thank You for Buying <span style="color: #0a960a;">Profit Plan Pro</span></h1>
                        <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${userData[0].name}</span>,</p>
                        <p>Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                        <p style="margin-bottom: -10px;">Following are some benefits of Profit Plans!</p>
                        <ul>
                            <li>Profit Plan Pro</li>
                            <li>Profit Plan Premium</li>
                        </ul>
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Total:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${charge.amount/100} MX</div>
                            </div>
                        </div>                                               
                        <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                        <p>Thank you once again for your business!</p>
                        <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                        <a href="${charge.receipt_url}" target="_blank" style="display: inline-block; background-color: #2fb82f; margin-left: 8px; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Receipt</a>
                    </div>
                </div>                
            `;
            // let htmlString=`
            // <html>
            //     <head>
            //     <style>
            //         .container {
            //         max-width: 600px;
            //         margin: 0 auto;
            //         background-color: #fff;
            //         border-radius: 5px;
            //         box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            //         padding: 30px;
            //         }
            //         .title {
            //         font-size: 22px;
            //         font-weight: bold;
            //         margin-top: 0;
            //         margin-bottom: 20px;
            //         color: #333;
            //         text-align: center;
            //         }
            //         .benefits {
            //         margin-bottom: -10px;
            //         }
            //         .btn {
            //         display: inline-block;
            //         background-color: #ffab40;
            //         color: #fff;
            //         padding: 7px 9px;
            //         font-size: 13px;
            //         border-radius: 5px;
            //         text-decoration: none;
            //         font-weight: bold;
            //         margin-bottom: 20px;
            //         }
            //         .btn-receipt {
            //         display: inline-block;
            //         background-color: #2fb82f;
            //         margin-left: 8px;
            //         color: #fff;
            //         padding: 7px 9px;
            //         font-size: 13px;
            //         border-radius: 5px;
            //         text-decoration: none;
            //         font-weight: bold;
            //         margin-bottom: 20px;
            //         }
            //         .total_receipt{
            //             padding: 5px 17px;
            //         }
            //         .total_receipt_lab{
            //             border: 2px solid red;
            //             height: 2rem;
            //             width: 100%;
            //             border: 1.5px solid #dbdbdb;
            //             background-color: "#e8e8e88a";
            //             border-radius: 7px;
            //             display: grid;
            //             grid-template-columns: 70% 30%;
            //         }
            //         .receipt_total{
            //             display: flex;
            //             align-items: center;
            //             padding-left: 12px;
            //             font-weight: 600;
            //         }
            //         .receipt_total_price{
            //             display:"flex";
            //             align-items: center;
            //         }
            //     </style>
            //     </head>
            //     <body style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
            //     <div class="container">
            //         <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
            //         <h1 class="title">Thank You for Buying <span style="color: #0a960a;">Profit Plan Pro</span></h1>
            //         <p>Dear <span style="font-weight: 600;">${userData[0].name}</span>,</p>
            //         <p>Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
            //         <p class="benefits">Following are some benefits of Profit Plans!</p>
            //         <ul>
            //         <li>Profit Plan Pro</li>
            //         <li>Profit Plan Premium</li>
            //         </ul>
            //         <div class="total_receipt" >
            //           <div class="total_receipt_lab">
            //             <div class="receipt_total" >Total:</div>
            //             <div class="receipt_total_price" >${charge.amount} MX</div>
            //           </div>            
            //         </div>
            //         <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.
            //         </p>
            //         <p>Thank you once again for your business!</p>
            //         <a href="https://multiplataforma-capital.com/" target="_blank" class="btn">Visit Our Website</a>
            //         <a href="${charge.receipt_url}" target="_blank" class="btn btn-receipt">Receipt</a>
            //     </div>
            //     </body>
            // </html>
            // `;
            const mailOptions = {
                from: 'xyzafaq@gmail.com',
                to: userData[0].email,
                subject: `Profit Plan ($${charge.amount/100} MX) Purchased Successfully!`,
                html: htmlString
            };
            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                console.log(error);
                } else {
                console.log('Email sent: ' + info.response);
                }
            });
        }
      } else {
        res.send({msg:'Payment failed'})
      }
    } catch (error) {
        res.send({msg:'Payment failed'})
    }
});
router.post('/api/paymentPremium/:id', async (req, res) => {
    try {
        console.log(req.body)
      const { amount, currency, token } = req.body;
      const charge = await stripe.charges.create({
        amount,
        currency,
        source: token,
        description: 'Profit Plan Premium'
      });
      if (charge.status === 'succeeded') {
        // console.log("SUCCESS");
        res.send({msg:"Payment successful"});
        const contractNumber = Date.now().toString().substring(6) + Math.floor(Math.random() * 100000000).toString().substring(0,7);
        // Save Payment info in user planHistory ARRAYs
        const result = await UserModel.updateOne(
            { _id: req.params.id },
            { $push: {
                planHistory: {
                  $each: [{
                    transaction_id: charge.transaction_id,
                    amount: charge.amount/100,
                    amount_captured: charge.amount_captured/100,
                    contractNumber: contractNumber,
                    profit:0,
                    name: charge.billing_details.name,
                    captured: charge.captured,
                    created: charge.created,
                    currency: charge.currency,
                    description: charge.description,
                    planName: charge.description,
                    paid: charge.paid,
                    brand: charge.payment_method_details.card.brand,
                    country: charge.payment_method_details.card.country,
                    exp_month: charge.payment_method_details.card.exp_month,
                    exp_year: charge.payment_method_details.card.exp_year,
                    funding: charge.payment_method_details.card.funding,
                    last4: charge.payment_method_details.card.last4,
                    network: charge.payment_method_details.card.network,
                    receipt_url: charge.receipt_url,
                    status: charge.status,
                  }],
                  $position: 0
                }
            }}
          );
        if(result){
            const result1 = await UserModel.findOne({_id:req.params.id},{totalbalance:1});
            const result2 = await UserModel.updateOne({_id:req.params.id},{ $set:{totalbalance: result1.totalbalance + (charge.amount/100),profit:0}});
            console.log(result);
            const userData = await UserModel.find({_id:req.params.id},{name:1,email:1});
            // console.log(userData[0].name);            
            // console.log(userData[0].email);
            let htmlString = `
                <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                        <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                        <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Thank You for Buying <span style="color: #0a960a;">Profit Plan Premium</span></h1>
                        <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${userData[0].name}</span>,</p>
                        <p>Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                        <p style="margin-bottom: -10px;">Following are some benefits of Profit Plans!</p>
                        <ul>
                            <li>Profit Plan Pro</li>
                            <li>Profit Plan Premium</li>
                        </ul>
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Total:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${charge.amount/100} MX</div>
                            </div>
                        </div> 
                        <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                        <p>Thank you once again for your business!</p>
                        <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                        <a href="${charge.receipt_url}" target="_blank" style="display: inline-block; background-color: #2fb82f; margin-left: 8px; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Receipt</a>
                    </div>
                </div>
            `;
            const mailOptions = {
                from: 'xyzafaq@gmail.com',
                to: userData[0].email,
                subject: `Profit Plan ($${charge.amount/100} MX) Purchased Successfully!`,
                html: htmlString
            };
            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                console.log(error);
                } else {
                console.log('Email sent: ' + info.response);
                }
            });
        }
      } else {
        res.send({msg:'Payment failed'})
      }
    } catch (error) {
        res.send({msg:'Payment failed'})
    }
});
// Membership 5000
router.post('/api/payment5000/:id', async (req, res) => {
    try {
        // console.log(req.params.id)
      const { amount, currency, token } = req.body;
      const charge = await stripe.charges.create({
        amount,
        currency,
        source: token,
        description: 'Investor Membership'
      });
      if (charge.status === 'succeeded') {
        res.send({msg:"Payment successful"});
        // Save Payment info in user membershipHistory ARRAYs
        const result = await UserModel.updateOne(
            { _id: req.params.id },
            { $push: {
                membershipHistory: {
                  $each: [{
                    transaction_id: charge.transaction_id,
                    amount: charge.amount/100,
                    amount_captured: charge.amount_captured/100,
                    name: charge.billing_details.name,
                    captured: charge.captured,
                    created: charge.created,
                    currency: charge.currency,
                    description: charge.description,
                    paid: charge.paid,
                    brand: charge.payment_method_details.card.brand,
                    country: charge.payment_method_details.card.country,
                    exp_month: charge.payment_method_details.card.exp_month,
                    exp_year: charge.payment_method_details.card.exp_year,
                    funding: charge.payment_method_details.card.funding,
                    last4: charge.payment_method_details.card.last4,
                    network: charge.payment_method_details.card.network,
                    receipt_url: charge.receipt_url,
                    status: charge.status,
                  }],
                  $position: 0
                }
            }}
          );
        if(result){            
            const currentDate = new Date();
            const membershipValid = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
            const result = await UserModel.updateOne({_id:req.params.id},{ $set:{membership:'investor',membershipValid}});
            // console.log(result);
            const userData = await UserModel.find({_id:req.params.id},{name:1,email:1});
            // console.log(userData[0].name);            
            // console.log(userData[0].email);
            let htmlString = `
                <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                        <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                        <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Thank You for Buying <span style="color: #0a960a;">Investor Membership</span></h1>
                        <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${userData[0].name}</span>,</p>
                        <p>Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                        <p style="margin-bottom: -10px;">Now you will be able to buy following Profit Plans!</p>
                        <ul>
                            <li>Profit Plan Pro</li>
                            <li>Profit Plan Premium</li>
                        </ul>
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Total:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${charge.amount/100} MX</div>
                            </div>
                        </div> 
                        <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                        <p>Thank you once again for your business!</p>
                        <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                        <a href="${charge.receipt_url}" target="_blank" style="display: inline-block; background-color: #2fb82f; margin-left: 8px; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Receipt</a>
                    </div>
                </div>
            `;
            const mailOptions = {
                from: 'xyzafaq@gmail.com',
                to: userData[0].email,
                subject: `Membership ($${charge.amount/100} MX) Purchased Successfully!`,
                html: htmlString
            };
            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                console.log(error);
                } else {
                console.log('Email sent: ' + info.response);
                }
            });
        }
      } else {
        res.send({msg:'Payment failed'})
      }
    } catch (error) {
        res.send({msg:'Payment failed'})
    }
});
// Membership 10,000
router.post('/api/payment10000/:id', async (req, res) => {
    try {
      const { amount, currency, token } = req.body;
      const charge = await stripe.charges.create({
        amount,
        currency,
        source: token,
        description: 'Founder Membership'
      });
      if (charge.status === 'succeeded') {
        const result = await UserModel.updateOne(
            { _id: req.params.id },
            { $push: {
                membershipHistory: {
                  $each: [{
                    transaction_id: charge.transaction_id,
                    amount: charge.amount/100,
                    amount_captured: charge.amount_captured/100,
                    name: charge.billing_details.name,
                    captured: charge.captured,
                    created: charge.created,
                    currency: charge.currency,
                    description: charge.description,
                    paid: charge.paid,
                    brand: charge.payment_method_details.card.brand,
                    country: charge.payment_method_details.card.country,
                    exp_month: charge.payment_method_details.card.exp_month,
                    exp_year: charge.payment_method_details.card.exp_year,
                    funding: charge.payment_method_details.card.funding,
                    last4: charge.payment_method_details.card.last4,
                    network: charge.payment_method_details.card.network,
                    receipt_url: charge.receipt_url,
                    status: charge.status,
                  }],
                  $position: 0
                }
            }}
        );
        if(result){
            res.send({msg:"Payment successful"});
            const currentDate = new Date();
            const membershipValid = new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate());
            const result = await UserModel.updateOne({_id:req.params.id},{ $set:{membership:'founder',membershipValid}});
            console.log(result);
            const userData = await UserModel.find({_id:req.params.id},{name:1,email:1});
            // console.log(userData[0].name);            
            // console.log(userData[0].email);
            let htmlString = `
                <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                    <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                        <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                        <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Thank You for Buying <span style="color: #0a960a;">Founder Membership</span></h1>
                        <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${userData[0].name}</span>,</p>
                        <p>Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                        <p style="margin-bottom: -10px;">Now you will be able to buy following Profit Plans!</p>
                        <ul>
                            <li>Profit Plan Pro</li>
                            <li>Profit Plan Premium</li>
                        </ul>
                        <div style="padding: 5px 17px; display: flex;">
                            <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Total:</div>
                                <div style="display: flex; margin: 0 11px; align-items: center;">$${charge.amount/100} MX</div>
                            </div>
                        </div> 
                        <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                        <p>Thank you once again for your business!</p>
                        <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                        <a href="${charge.receipt_url}" target="_blank" style="display: inline-block; background-color: #2fb82f; margin-left: 8px; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Receipt</a>
                    </div>
                </div>
            `;
            const mailOptions = {
                from: 'xyzafaq@gmail.com',
                to: userData[0].email,
                subject: `Membership ($${charge.amount/100} MX) Purchased Successfully!`,
                html: htmlString
            };
            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                console.log(error);
                } else {
                console.log('Email sent: ' + info.response);
                }
            });
        }
      } else {
        res.send({msg:'Payment failed'})
      }
    } catch (error) {
        res.send({msg:'Payment failed'})
    }
});
router.get('/',(req,res)=>{
    try {
        console.log('homePage started');
    // res.send('Home Page');
    } catch (error) {
        console.log(error);
    }
})
router.get('/email',(req,res)=>{
    try {
        console.log("EMAIL");
        // create the HTML string with inline CSS
        let htmlString = `<div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
            <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                <h1 style="font-size: 28px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Thank You for Using Our Services</h1>
                <p style="margin: 0 0 20px;">Dear [Client Name],</p>
                <p>Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                <p>If you have any questions or concerns, please do not hesitate to contact us at [Your Email Address].</p>
                <p>Thank you once again for your business!</p>
                <a href="[Your Website URL]" class="btn" style="display: inline-block; background-color: #007bff; color: #fff; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
            </div>
        </div>`;
        const mailOptions = {
            from: 'xyzafaq@gmail.com',
            to: 'afaqprince104@gmail.com',
            subject: 'Login Successful',
            html: htmlString
          };
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
        });
    } catch (error) {
        console.log(error);
    }
})
router.post('/signup',async (req,res)=>{
    try {
        console.log(req.body);
        const {name,email,password,confirmpassword,birthday} = req.body;
        // const thirtyDaysFromNow = new Date();
        // thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        if(!name || !email || !password){
            res.status(201).json({msg:"Please Fill all Fields"})
        }
        if(password !== confirmpassword){
            res.json('Password does not Match');
        }
        const checkUser = await UserModel.findOne({email:email});
        
        if(checkUser){
            return res.json({msg:'User Already Registered'})
        }else{
            const newUser = UserModel({name,email,password,birthday,totalbalance:0,ppstart:0,ppadvance:0,pppro:0,initialcapital:0,grancias:0,
                bloqueado:0,disponible:0,miembrostotale:0,derivadostotale:0,rangostotale:0,ultimorango:'',saldo:0,cartera:"-",
                mymembresia:"",estrategia:"",ganaciasretirades:0,totaldisponible:0,pic:0,tc:0,membreciabtc500:0,membreciabtc1000:0,
                fullname:"",bankname:"",iban:"",phone:"",country:"",plan:"free",membership:'none',bonusc1e1:'0',bonusc1e2:'0',
                bonusc1e3:'0',bonusc1e4:'0',bonusc2e1:'0',bonusc2e2:'0',bonusc2e3:'0',bonusc2e4:'0'
            });
            const result = await newUser.save();
            if(result){
                const token = await result.generateAuthToken();
                // res.cookie('jwttoken',token);
                // UserModel({isLoggedIn:true}).save();
                res.status(201).json({msg:'User Registered Successfuly.',authToken:token});
            }else{
                res.status(201).json({msg:'Failed to Register'});
            }
        }
    } catch (error) {
        console.log(error);
    }
})
router.post('/login',async (req,res)=>{
    // console.log(req.body);
    try {
        const {email,password} = req.body;
        if(!email || !password){
            res.send({msg:'Invalid Credentials'});
        }
        const result = await UserModel.findOne({email:email});
        if(!result){
            res.send({msg:'Invalid Credentials'});
        }else{
            const checkPassword = await bcrypt.compare(password,result.password);
            if(checkPassword){
                const token = await result.generateAuthToken();
                // res.cookie('jwttoken',token);
                if(result.email == "alan@admin.com"){
                    res.send({msg:"admin",authToken:token});
                }else{
                    res.send({user:result,authToken:token});
                }
            }else{
                res.send({msg:'Invalid Credentials'});
            }
        }
    } catch (error) {
        console.log(error);
    }
})
router.get('/isloggedin', async (req,res)=>{
    try {
        const token = req.header("authToken");
        if(token.length>10){
            const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
            const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
            if(rootUser){
                if(rootUser.email == "alan@admin.com"){
                    res.send({msg:"admin"});
                }else{
                    res.send({msg:"loggedin",data:rootUser});
                }
            }
        }
    } catch (error) {
        console.log(error);
    }
})
router.get('/allUser', async(req,res)=>{
    try {
        const result = await UserModel.find({ email: { $ne: 'alan@admin.com' } });
        if(result){
            res.json(result);
        }
    } catch (error) {
        console.log(error);
    }
})
router.post('/updateUser/:id', async (req,res)=>{
    try {
        // console.log(req.body);
        // console.log(req.params.id);
        var id = req.params.id;
        const {name,email,totalbalance,ppstart,ppadvance,pppro,initialcapital,grancias,bloqueado,disponible,miembrostotale,derivadostotale,rangostotale,ultimorango,saldo,cartera,mymembresia,estrategia,ganaciasretirades,totaldisponible,pic,tc,membreciabtc500,membreciabtc1000,plan,bonusc1e1,bonusc1e2,bonusc1e3,bonusc1e4,bonusc2e1,bonusc2e2,bonusc2e3,bonusc2e4,membership,membershipValid} = req.body;
        // console.log(id);
        const result = await UserModel.updateOne({_id:id},{ $set:{name,email,totalbalance,ppstart,ppadvance,pppro,initialcapital,grancias,bloqueado,disponible,miembrostotale,derivadostotale,rangostotale,ultimorango,saldo,cartera,mymembresia,estrategia,ganaciasretirades,totaldisponible,pic,tc,membreciabtc500,membreciabtc1000,plan,bonusc1e1,bonusc1e2,bonusc1e3,bonusc1e4,bonusc2e1,bonusc2e2,bonusc2e3,bonusc2e4,membership,membershipValid}})
        // console.log(result);
        if(result){
            res.send({msg:"success"});
        }
    } catch (error) {
     console.log(error);
    }
})
router.post('/updateUser2/:id', async (req,res)=>{
    try {
        console.log(req.body);
        console.log(req.params.id);
        //var id = req.params.id;
        const {date,planName,profit,contractNumber,amount} = req.body;
        // console.log(id);
        const result2 = await UserModel.updateOne({_id:req.params.id},{$push:{planHistory:{$each: [req.body], $position: 0 }}});
        console.log(result2);
        if(result2){
            res.send({msg:"success"});
        }else{
            res.send({msg:"failed"});
        }
    } catch (error) {
     console.log(error);   
    }
})
router.post('/updatePlanHistory/:id', async (req,res)=>{
    try {
        console.log(req.body);
        console.log(req.params.id);
        const result = await UserModel.findOneAndUpdate({ 'planHistory._id': req.params.id },{ $set: { 'planHistory.$': req.body } },{ new: true });
        if(result){
            //console.log(result);
            res.send({msg:"success"});
        }else{
            res.send({msg:"failed"});
        }
    } catch (error) {
     console.log(error);   
    }
})
router.get('/deleteUser/:id', async (req,res)=>{
    try {
        // console.log(req.params.id);
        const result2 = await UserModel.find({_id: req.params.id},{email:1});
        if(result2[0].email !== 'alan@admin.com'){
            const result = await UserModel.deleteOne({_id:req.params.id});
            if(result){
                res.send({msg:"success"});
            }
        }
    } catch (error) {
        console.log(error);   
    }
})
router.post('/bankinfo', async (req,res)=>{
    // console.log(req.body);
    try {
        const { fullname, bankname, iban, phone, country } = req.body;
        //const token = req.cookies.jwttoken;
        const token = req.header("authToken");
        if(token.length >10){
            // console.log(token);
            const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
            const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
            // console.log(rootUser);
            const result = await UserModel.updateOne({_id:rootUser._id},{ $set:{fullname, bankname, iban, phone, country}});
            // console.log(result);
            if(result){
                res.send({msg:"success"});
            }
        }
    } catch (error) {
     console.log(error);   
    }
})
router.post('/UpdateBankinfo/:id', async (req,res)=>{
    try {
        // console.log(req.body);
        // console.log(req.params.id);
        const { fullname, bankname, iban, phone, country } = req.body;
        const result = await UserModel.updateOne({_id:req.params.id},{ $set:{fullname, bankname, iban, phone, country}});
        if(result){
            res.send({msg:"success"});
        }else{
            res.send({msg:"failed"});
        }
    } catch (error) {
     console.log(error);   
    }
})
router.post('/withdrawrequest', async (req,res)=>{
    try {
        // console.log(req.body);
        const { withdraw } = req.body;
        const token = req.header("authToken");
        if(token.length>10){
            const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
            const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
            const result = await UserModel.findOne({ _id: rootUser._id},{withdraws: 1})            
            // const result2 = await UserModel.updateOne({_id:rootUser._id},{$push:{withdraws:{withdraw,name:rootUser.name,email:rootUser.email,userid: rootUser._id}}});
            
            if(result.withdraws.length === 0 && rootUser.disponible>=withdraw){
                const result2 = await UserModel.updateOne(
                    { _id: rootUser._id },
                    {$push: {
                        withdraws: {
                          $each: [
                            { withdraw, name: rootUser.name, email: rootUser.email, userid: rootUser._id }
                          ],
                          $position: 0
                }}});
                if(result2){
                    res.send({msg:"success"});
                    const result3 = await UserModel.updateOne(
                        { _id: rootUser._id },
                        {$push: {
                            withdrawHistory: {
                              $each: [
                                { amount: withdraw,status: 'Pending',}
                              ],
                              $position: 0
                    }}});
                    let htmlString = `
                        <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                            <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                                <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                                <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">We have received your <span style="color: #0a960a;">withdrawal request</span></h1>
                                <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${rootUser.name}</span>,</p>
                                <p>We have received your withdrawal request of <span style="color: #0a960a;font-weight:600;">$${withdraw}</span> and it will be considered within 24 Hours. Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                                <div style="padding: 5px 17px; display: flex;">
                                    <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                        <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Withdraw Amount:</div>
                                        <div style="display: flex; margin: 0 11px; align-items: center;">$${withdraw} MX</div>
                                    </div>
                                </div> 
                                <p>You'll be informed about final decision within 24 Hours if it's Cancelled or Approved.</p>
                                <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                                <p>Thank you once again for your business!</p>
                                <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                            </div>
                        </div>
                    `;
                    const mailOptions = {
                        from: 'xyzafaq@gmail.com',
                        to: rootUser.email,
                        subject: `Withdraw request of $${withdraw} MX submitted!`,
                        html: htmlString
                    };
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                        console.log(error);
                        } else {
                        console.log('Email sent: ' + info.response);
                        }
                    });                
                }
            }else{
                res.send({msg:"already requestd"});
            }
        }
    } catch (error) {
     console.log(error);   
    }
})
router.post('/contactQuerie', async (req,res)=>{
    try {
        console.log(req.body);
        if( req.body.email == '' || req.body.subject=='' || req.body.message==''){
            console.log("EMPTY MESSAGE")
        }else{
            // const { name,subject,email,phone,message } = req.body;
            const token = req.header("authToken");
            if(token.length >10 ){  // Queries from users that are Signed in
                const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
                const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
                const result = await UserModel.findOne({ _id: rootUser._id},{contactQueries: 1})
                //console.log( result.contactQueries.length);
                if(result.contactQueries.length < 3){
                    const result2 = await UserModel.updateOne({_id:rootUser._id},{$push:{contactQueries:req.body}});
                    if(result2){
                        res.send({msg:"success"});
                    }else{
                        res.send({msg:"error"});
                    }
                }else{
                    res.send({msg:"limit reached"});
                }
            }else{
                const newQuerie = QueriesModel(req.body);
                const result4 = await newQuerie.save();
                if(result4){
                    res.send({msg:'success'});
                }else{
                    res.send({msg:'error'});                
                }
            }
        }
    } catch (error) {
     console.log(error);   
    }
})
router.get('/allqueries', async (req,res)=>{
    try {        
        const results = await UserModel.find({}, { contactQueries:1});
        // console.log(results);
        let queriesArray = [];
        results.forEach((result) => {
        queriesArray = queriesArray.concat(result.contactQueries);
        });
        // console.log(withdrawalsArray);
        if(results){
            res.send({result: queriesArray })
        }
    } catch (error) {
     console.log(error);   
    }
})
router.get('/deleteQuery/:id',async (req,res)=>{
    try {
        console.log(req.params.id);
        const contactQueryId = req.params.id;
        // const result = await UserModel.deleteOne({ _id: req.params.id }, { withdraws: [] });
        const result = await UserModel.updateOne({ "contactQueries._id": contactQueryId },{ $pull: { contactQueries: { _id: contactQueryId } } });
        // console.log(result);
        if(result){
            res.send({msg: "success" })
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/allContactQuery', async (req,res)=>{
    try {        
        const results = await QueriesModel.find();
        // console.log(results);
        if(results){
            res.send({result: results })
        }
    } catch (error) {
     console.log(error);   
    }
})
router.get('/deleteContactQuery/:id',async (req,res)=>{
    try {
        const result = await QueriesModel.deleteOne({_id: req.params.id});
        if(result){
            res.send({msg: "success" })
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/AllwithdrawalRequests',async (req,res)=>{
    try {
        const results = await UserModel.find({}, { withdraws:1});
        // console.log(results);
        let withdrawalsArray = [];
        results.forEach((result) => {
        withdrawalsArray = withdrawalsArray.concat(result.withdraws);
        });
        // console.log(withdrawalsArray);
        if(results){
            res.send({msg: withdrawalsArray })
        }
    } catch (error) {
            console.log(error);
        }
})
router.post('/getuserdata',async (req,res)=>{
    try {
        const { id } = req.body;
        const result = await UserModel.findOne({_id:id});
        if(result){
            // console.log(result);
            res.send(result);
        }
    } catch (error) {
            console.log(error);
        }
})
router.get('/getuserdata/:id',async (req,res)=>{
    try {
        const result = await UserModel.findOne({_id: req.params.id });
        if(result){
            // console.log(result);
            res.send(result);
        }
    } catch (error) {
            console.log(error);
        }
})
router.get('/logout',async(req,res)=>{
    try {
        // const token = req.cookies.jwttoken;
        const token = req.header("authToken");
        const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
        const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
        if(rootUser){
            //res.clearCookie('jwttoken');
            res.send({msg:"loggedOut"});
        }
    } catch (error) {
        console.log(error);
    }
})
router.post('/addmember', async (req,res)=>{
    try {
        // console.log(req.body);    
        // const token = req.cookies.jwttoken;
        const token = req.header("authToken");
        const {name,email,password,confirmpassword,birthday} = req.body;
        if(!name || !email || !password){
            res.status(201).json({msg:"Please Fill all Fields"})
        }
        if(password !== confirmpassword){
            res.json('Password does not Match');
        }
        const checkUser = await UserModel.findOne({email:email});
        
        if(checkUser){
            return res.json({msg:'User Already Registered'})
        }else{
            const newUser = UserModel({name,email,password,birthday,totalbalance:0,ppstart:0,ppadvance:0,pppro:0,initialcapital:0,grancias:0,
            bloqueado:0,disponible:0,miembrostotale:0,derivadostotale:0,rangostotale:0,ultimorango:0,saldo:0,cartera:"",
            mymembresia:"",estrategia:"",ganaciasretirades:0,totaldisponible:0,pic:0,tc:0,membreciabtc500:0,membreciabtc1000:0,
            fullname:"",bankname:"",iban:"",phone:"",country:"",plan:"free",membership:'none',bonusc1e1:'0',bonusc1e2:'0',
            bonusc1e3:'0',bonusc1e4:'0',bonusc2e1:'0',bonusc2e2:'0',bonusc2e3:'0',bonusc2e4:'0'});
            const result = await newUser.save();
            if(result){
                const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
                const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
                if(rootUser){
                    const result2 = await UserModel.updateOne({_id:rootUser._id},{$push:{addedMembers:{email}}});
                    if(result2){
                        const newUser = NotifyModel({adder:rootUser.email,added:email});
                        const result4 = await newUser.save();          
                        res.send({msg:"success"});                 
                    }
                }
            }else{
                res.status(201).json({msg:'Failed to Register'});
            }
        }
    } catch (error) {
        console.log(error);
    }
})
router.post('/addCoupon', async (req,res)=>{
    try {
        // console.log(req.body);
        const newCoupon = CouponModel(req.body);
        const result = await newCoupon.save();
        if(result){
            res.send({msg:'success'});
        }else{
            res.send({msg:'error'});                
        }        
    } catch (error) {
        console.log(error);
    }
})
router.get('/getCoupons', async (req,res)=>{
    try {
        // console.log(req.body);
        const result = await CouponModel.find();
        if(result){
            res.send({msg:'success',data:result});
        }else{
            res.send({msg:'error'});                
        }        
    } catch (error) {
        console.log(error);
    }
})
router.get('/deleteCoupon/:id', async (req,res)=>{
    try {
        // console.log(req.params.id);
        const result = await CouponModel.deleteOne({_id:req.params.id});
        if(result){
            res.send({msg:'success'});
        }else{
            res.send({msg:'error'});
        }        
    } catch (error) {
        console.log(error);
    }
})
router.get('/getNotifications',async (req,res)=>{
    try {
        const result = await NotifyModel.find();
        if(result){
            // console.log(result);
            res.send(result);
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/deleteNotify/:id',async (req,res)=>{
    try {
        const result = await NotifyModel.deleteOne({_id:req.params.id});
        if(result){
            res.send({msg:'success'});
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/getProfitHistory',async (req,res)=>{
    try {
        const result = await ProfitDetailModel.find().sort({ date: -1 });
        if(result){
            // console.log(result);
            res.send(result);
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/deleteProfitHist/:id',async (req,res)=>{
    try {
        const result = await ProfitDetailModel.deleteOne({_id:req.params.id});
        if(result){
            res.send({msg:'success'});
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/getMembers',async (req,res)=>{
    try {
        const token = req.header("authToken");
        //console.log(token.length);
        if(token.length>10){            
            const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
            const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
            const result = await UserModel.findOne({ _id: rootUser._id },{ addedMembers :{email:1}});
            
            if(result){
                // console.log(result.addedMembers);
                res.send(result.addedMembers);
            }
        } else{
            //console.log("TOKEN NOT RECEIVED");
        }
    } catch (error) {
        console.log(error);
    }    
})
router.post('/updatePassword',async(req,res)=>{
    try { 
        let {oldPassword,newPassword,confirmNewPassword} = req.body;
        if(!oldPassword || !newPassword || !confirmNewPassword){
            res.send({msg:"unfill"});
        }else if(newPassword!=confirmNewPassword){
            res.send({msg:"NotMatching"});
        }else if(newPassword.length<8){
            res.send({msg:"Password must contain 8 characters"});
        }else{
            const token = req.header("authToken");
            if( token.length > 10 ){
                const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
                const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
                const veriFyoldPassword = await bcrypt.compare(oldPassword,rootUser.password);
                if(veriFyoldPassword){
                    newPassword = await bcrypt.hash(newPassword,12);
                    const result = await UserModel.updateOne({_id:rootUser._id},{ $set:{ password:newPassword }})
                    if(result){
                        res.send({msg:"success"})
                    }
                }else{
                    res.send({msg:"incorrect Password"});
                }
            }   
        }                
    } catch (error) {
        console.log(error);
    }
})
router.post('/updatePasswordOTP/:id',async(req,res)=>{
    try { 
        let {otp,newPassword,confirmNewPassword} = req.body;
        console.log(req.body);
        if(!otp || !newPassword || !confirmNewPassword){
            res.send({msg:"unfill"});
        }else if(newPassword!=confirmNewPassword){
            res.send({msg:"NotMatching"});
        }else if(newPassword.length<8){
            res.send({msg:"Password must contain 8 characters"});
        }else{            
             console.log(req.params.id);
            const user = await UserModel.findOne({email:req.params.id});
            if(user){
                if(user.otp[0].code == otp ){
                    console.log("MATCHED")
                    newPassword = await bcrypt.hash(newPassword,12);
                    const result = await UserModel.updateOne({_id:user._id},{ $set:{ password:newPassword, otp:[] }});
                    console.log(result)
                    if(result){
                        res.send({msg:"success"})
                    }
                }else{
                    //console.log("Not MATCHED")
                    res.send({msg:"invalid"});
                }
            }
        }                
    } catch (error) {
        console.log(error);
    }
})
router.post('/checkUser',async(req,res)=>{
    try { 
        //console.log(req.body);
        const checkUser = await UserModel.findOne({email:req.body.email});
        if(checkUser){
            let OTP = Math.floor(Math.random() * 900000) + 100000;
            // OTP = OTP.toString();
            // const saveOTP = await UserModel.updateOne({_id:checkUser._id},{$push:{otp:{code:OTP}}});
            const saveOTP = await UserModel.findOneAndUpdate(
                { _id: checkUser._id },
                { $push: { otp: { $each: [{ code: OTP }], $position: 0 } } },
                { new: true }
              );                         
            let htmlString=`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>One-Time Password for Password Reset</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 16px;
                        line-height: 1.5;
                        color: #333333;
                        background-color: #f2f2f2;
                    }
                    h1, h2, h3, h4, h5, h6 {
                        margin: 0;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #ffffff;
                        border-radius: 5px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .btn {
                        display: inline-block;
                        padding: 10px 20px;
                        background-color: #ef9523;
                        color: white;
                        text-decoration: none;
                        border-radius: 3px;
                        border: none;
                        cursor: pointer;
                        box-shadow: 0 2px 4px #ef9523;
                        transition: background-color 0.2s ease-in-out;
                    }                    
                </style>
            </head>
            <body>
                <div class="container">
                    <div style="font-size: 26px; font-weight: bold; margin-top: 0; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                    <h1 style="font-size: 22px;" >One-Time Password for Password Reset</h1>
                    <p style="font-size: 16px;" >Dear <span style="font-weight:600;" >${checkUser.name}</span> ,</p>
                    <p style="font-size: 16px;" >We have received a request to reset the password for your account associated with ${checkUser.email}. To proceed with the password reset, please use the following One-Time Password (OTP):</p>
                    <p style="font-size: 24px; font-weight: bold; color: #ef9523;">${OTP}</p>
                    <p style="font-size: 16px;" >Please note that this OTP is valid only for a limited period and should not be shared with anyone. To reset your password, please enter the OTP on the password reset page.</p>
                    <p style="font-size: 16px;" >If you did not request this password reset, please contact our support team immediately.</p>
                    <a style="color: white;" href="https://multiplataforma-capital.com/updatepassword" class="btn">Reset Password</a>
                    <p style="font-size: 16px;" >Thank you for using our service.</p>
                    <p style="font-size: 16px;" >Best regards,</p>
                    <p style="font-size: 16px;" >Multiplataforma-capital</p>
                </div>
            </body>
            </html>            
            `     
            const mailOptions = {
                from: 'xyzafaq@gmail.com',
                to: checkUser.email,
                subject: `Password Reset with One-Time-Password (OTP)`,
                html: htmlString
            };
            transporter.sendMail(mailOptions, function(error, info){
                if (error) {
                console.log(error);
                } else {
                console.log('Email sent: ' + info.response);
                }
            });
            res.send({msg:'valid'});
        }else{
            res.send({msg:'invalid'});
        }
    } catch (error) {
        console.log(error);
    }
})
router.get('/userData',async (req,res)=>{
    try {
        // const token = req.cookies.jwttoken;
        const token = req.header("authToken");
        //console.log(token.length);
        if(token.length>10){
            //console.log("TOKEN RECEIVED");
            const verifyToken = jwt.verify(token,"helloiamafaqstudentofuniversityofmanagementandtechonology");
            const rootUser = await UserModel.findOne({_id:verifyToken._id,"tokens.token":token});
            if(rootUser){
                res.send(rootUser);
            }  
        } else{
            //console.log("TOKEN NOT RECEIVED");
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/userData/:id',async (req,res)=>{
    try {
        // console.log(req.params.id);
        const result = await UserModel.findOne( { withdraws: { $elemMatch: { _id: req.params.id } } });
        // console.log(result);
        if(result){
            res.send({msg: result })
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/deleteWithdrawReq/:id',async (req,res)=>{
    try {
        // console.log(req.params.id); //ID of withdraw object
        const user = await UserModel.findOne({'withdraws._id':req.params.id});
        const amount = user.withdraws[0].withdraw;
        const result = await UserModel.updateOne({'withdraws._id':req.params.id}, { $set: { withdraws: [] } });

        if(result){
            res.send({msg: "success" })
            const result2 = await UserModel.updateOne({_id:user._id,'withdrawHistory._id': user.withdrawHistory[0]._id},{ $set: { 'withdrawHistory.$.status': 'Cancelled'}});
            let htmlString = `
                        <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                            <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                                <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                                <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Oops! your withdraw request is <span style="color: #cf2525;">Cancelled</span></h1>
                                <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${user.name}</span>,</p>
                                <p>Your withdraw request of <span style="color: #0a960a;font-weight:600;">$${amount}</span> has been Cancelled due to some reasons. Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                                <div style="padding: 5px 17px; display: flex;">
                                    <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                        <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Requested Amount:</div>
                                        <div style="display: flex; margin: 0 11px; align-items: center;">$${amount} MX</div>
                                    </div>
                                </div> 
                                <p>Anyhow you can make another withdraw request.</p>
                                <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                                <p>Thank you once again for your business!</p>
                                <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                            </div>
                        </div>
                    `;
                    const mailOptions = {
                        from: 'xyzafaq@gmail.com',
                        to: user.email,
                        subject: `Withdraw request $${amount} MX is Cancelled!`,
                        html: htmlString
                    };
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                        console.log(error);
                        } else {
                        console.log('Email sent: ' + info.response);
                        }
                    }); 
        }
    } catch (error) {
        console.log(error);
    }    
})
router.get('/approveWithdrawReq/:id/:amount',async (req,res)=>{
    try {
        // console.log(req.params.amount); //ID of withdraw object
        const amount = req.params.amount;
        // const user = await UserModel.findOne({'withdraws._id':req.params.id},{ 'withdraws.$': 1 });
        const user = await UserModel.findOne({'withdraws._id':req.params.id});
        if(user.disponible>=req.params.amount){
            const result = await UserModel.updateOne({'withdraws._id':req.params.id}, { $inc: { disponible: -req.params.amount,totalbalance: -req.params.amount },$set: { withdraws: [] } });
            if(result){
                res.send({msg: "success" });
                const result2 = await UserModel.updateOne({_id:user._id,'withdrawHistory._id': user.withdrawHistory[0]._id},{ $set: { 'withdrawHistory.$.status': 'Approved'}});
                let htmlString = `
                        <div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #333; background-color: #f7f7f7; padding: 20px;">
                            <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #fff; border-radius: 5px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); padding: 30px;">
                                <div style="font-size: 26px; font-weight: bold; margin-top: 0; margin-bottom: 10px; color: #EF9523; text-align: center;">Multiplataforma-capital.com</div>
                                <h1 style="font-size: 22px; font-weight: bold; margin-top: 0; margin-bottom: 20px; color: #333; text-align: center;">Congrats! your withdraw request is <span style="color: #0a960a;">Approved</span></h1>
                                <p style="margin: 0 0 10px;">Dear <span style="font-weight: 600;">${user.name}</span>,</p>
                                <p>Your withdraw request of <span style="color: #0a960a;font-weight:600;">$${amount}</span> has been Approved and funds are being tranffered. Thank you for choosing our services for your needs. We are grateful for the opportunity to serve you and we hope that you were satisfied with our work. We appreciate your trust in us and we look forward to working with you again in the future.</p>
                                <div style="padding: 5px 17px; display: flex;">
                                    <div style="border: 1.5px solid #dbdbdb; border-radius: 7px; background-color: #e8e8e88a; height: 1.5rem; display: flex;">
                                        <div style="display: flex; align-items: center; padding-left: 12px; font-weight: 600;">Amount transferred:</div>
                                        <div style="display: flex; margin: 0 11px; align-items: center;">$${amount} MX</div>
                                    </div>
                                </div> 
                                <p>Now you will be able to make another withdraw request.</p>
                                <p>If you have any questions or concerns, please do not hesitate to contact us at <span style="color: #0a960a; font-weight: 600;">soporte@multiplataformacapital.com</span>.</p>
                                <p>Thank you once again for your business!</p>
                                <a href="https://multiplataforma-capital.com/" target="_blank" style="display: inline-block; background-color: #ffab40; color: #fff; padding: 7px 9px; font-size: 13px; border-radius: 5px; text-decoration: none; font-weight: bold; margin-bottom: 20px;">Visit Our Website</a>
                            </div>
                        </div>
                    `;
                    const mailOptions = {
                        from: 'xyzafaq@gmail.com',
                        to: user.email,
                        subject: `Amount $${amount} MX transferred Successfully to your account!`,
                        html: htmlString
                    };
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                        console.log(error);
                        } else {
                        console.log('Email sent: ' + info.response);
                        }
                    });  
            }
        }
    } catch (error) {
        console.log(error);
    }
})
router.post('/searchUser', async(req,res)=>{
    try {
        const {email} = req.body;
        console.log(email);
        const user = await UserModel.find({email});
        if(user){
            res.send( { msg:"success", userdata: user } );
        }else{
            res.send({msg:'not found'});
        }
    } catch (error) {
        console.log(error)
    }
})
module.exports = router;