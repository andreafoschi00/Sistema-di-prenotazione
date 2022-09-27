/**
 * MODULES IMPORT
 */

const express = require("express");
const axios = require('axios');
const https = require("https");
const uuid = require('uuid');
const {encrypt, decrypt} = require('./../encryption/encryption');

/**
 * ROUTES
 */

const recordRoutes = express.Router();

/**
 * DB
 */

const dbo = require("./../db/conn.js");// This will help us connect to the database

/**
 * GOOGLE
 */

const {google} = require('googleapis');
const calendar = google.calendar('v3');
var oauth2Client = new google.auth.OAuth2(
    '504181834497-omrl5mnes3qmvvu39hu5v404lemlfq1c.apps.googleusercontent.com',
    "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",
    "postmessage" // you use 'postmessage' when the code is retrieved from a frontend (couldn't find why online)
);

/**
 * -------------- MY METHODS ---------------
 */

/**
 * FETCH ACTIVITIES
 * Fetches data for customize page based on the id
 */
recordRoutes.route("/customize/:id").get(function (request, response) {
    let db_connect = dbo.getDb();
    let myQuery = {restaurantId: request.params.id};
    db_connect
        .collection("customize")
        .findOne(myQuery, function (err, result) {
            if (err) throw err;
            response.json(result);
        });
});

/**
 * FETCH CUSTOMIZATION SETTINGS
 * Fetches data for customize page based on the id
 */
recordRoutes.route("/activities/:id").get(function (request, response) {
    let db_connect = dbo.getDb();
    let myQuery = {restaurantId: request.params.id};
    db_connect
        .collection("activities")
        .findOne(myQuery, function (err, result) {
            if (err) throw err;
            response.json(result);
        });
});

/**
 * FETCH BOOKINGS
 * Fetches bookings regarding restaurant with id passed as parameter
 */
recordRoutes.route("/bookings/:id").get(function (request, response) {
    let db_connect = dbo.getDb();
    let myQuery = {restaurantId: request.params.id};
    db_connect
        .collection("booking") // <------------- rename collection to bookingS
        .findOne(myQuery, function (err, result) {
            if (err) throw err;
            response.json(result);
        });
});

/**
 * FETCH RESTAURANT INFO
 * Fetches infos about restaurant
 */
recordRoutes.route("/customize/:id").get(function (request, response) {
    let db_connect = dbo.getDb();
    let myQuery = {restaurantId: request.params.id};
    db_connect
        .collection("customize") //
        .findOne(myQuery, function (err, result) {
            if (err) throw err;
            response.json(result);
        });
});

/**
 * FETCH AUTHENTICATION
 * Fetches infos about restaurant
 */
recordRoutes.route("/authentication").post(async function (request, response) {
    let db_connect = dbo.getDb("sdp_db");
    let email = request.body.email
    let password = request.body.password
    let users = await db_connect
        .collection("authentication")
        .find().toArray()
    let respMessage = {}
    users.forEach((user) => {
        let decrypted = JSON.parse(decrypt(user.credentials))
        if (decrypted.email === email) {
            if (decrypted.password === password) {
                respMessage = {
                    restaurantId: user.restaurantId
                }
            }
        }
    })
    response.json(respMessage)
});

/**
 * ----------- SAVE CHANGES TO DB ----------------
 */

/**
 * UPDATE CUSTOMIZE INFO
 */
recordRoutes.route("/customize/save_changes/:id").post(function (request, response) {
    let db_connect = dbo.getDb("sdp_db");
    let myQuery = {restaurantId: request.params.id};
    let newValues = {
        $set: {
            additionalInfo: request.body.additionalInfo,
            primaryColor: request.body.primaryColor,
            secondaryColor: request.body.secondaryColor,
            logoPath: request.body.logoPath,
            socialNetworks: request.body.socialNetworks,
            restaurantName: request.body.restaurantName
        },
    };
    db_connect
        .collection("customize")
        .updateOne(myQuery, newValues, function (err, result) {
            if (err) {
                response.status(501)
                console.log("Error updating customize: " + err)
            } else {
                response.status(201)
                console.log("1 document updated");
                response.json(result);
            }
        });
});

/**
 * UPDATE ACTIVITIES
 */
recordRoutes.route("/activities/save_changes/:id").post(function (request, response) {
    let db_connect = dbo.getDb("sdp_db");
    let myQuery = {restaurantId: request.params.id};
    let newValues = {
        $set: {
            bookingForewarning: request.body.bookingForewarning,
            bookingThreshold: request.body.bookingThreshold,
            bookingOffset: request.body.bookingOffset,
            activities: request.body.activities
        },
    };
    db_connect
        .collection("activities")
        .updateOne(myQuery, newValues, function (err, result) {
            if (err) {
                response.status(501)
                console.log("Error updating activities: " + err)
            } else {
                response.status(201)
                console.log("1 document updated");
                response.json(result);
            }
        });
});

/**
 * UPDATE BOOKINGS
 * Sets booking's new status when it gets changed by the user in the management page
 */
recordRoutes.route("/bookings/save_changes/:id/:bookingId").post(async function (request, response) {
    let db_connect = dbo.getDb("sdp_db");
    let newStatus = request.body.newStatus
    let bookingId = request.params.bookingId
    let restaurantId = request.params.id
    let myQuery = {
        restaurantId: restaurantId, 'bookings.id': bookingId
    };
    let newValues = {
        $set: {
            'bookings.$.bookingStatus': newStatus
        },
    };
    let restaurantBookings = await getRestaurantBookingsById(restaurantId, bookingId)
    let booking = getBookingById(restaurantBookings.bookings, bookingId)

    let addToCalendar = // add to calendar if the status goes to confirmed from pending
        booking.bookingStatus === 'pending'
        && newStatus === 'confirmed'

    let removeFromCalendar = //  remove from calendar if going to canceled from confirmed
        booking.bookingStatus === 'confirmed'
        && newStatus === 'canceled'

    db_connect
        .collection("booking")
        .updateOne(myQuery, newValues, async function (err, result) {
            if (err) {
                response.status(501)
                console.log("Error updating bookings: " + err)
            } else {
                if(addToCalendar)
                    await addBookingToCalendar(restaurantId, booking)
                else if (removeFromCalendar)
                    await removeBookingFromCalendar(restaurantId, booking.id)
                response.status(201)
                console.log("1 document updated");
                response.json(result);
            }
        });

    // Add new event to calendar if the new status is confirmed
});

function getBookingById(bookings, bookingId) {
    return bookings.find(b => b.id === bookingId)
}

async function getRestaurantBookingsById(restaurantId, bookingId) {
    let db_connect = dbo.getDb("sdp_db");
    let myQuery = {
        restaurantId: restaurantId,
        'bookings.id': bookingId
    };
    return db_connect
        .collection('booking')
        .findOne(myQuery)
}

/**
 * Get booked seats given activity for specified day
 */
recordRoutes.route("/bookings/seats/:id/:day/:activity").get(async function (request, response) {
    let db_connect = dbo.getDb("sdp_db");
    let myQuery = {
        restaurantId: request.params.id,
    };

    let bookingArray = await db_connect
        .collection("booking")
        .findOne(myQuery);

    let respMessage = {};
    let seats = 0;
    let day = new Date(request.params.day);
    let date = day.getFullYear() + '-' + (day.getMonth() + 1) + '-' + day.getDate();
    let activity = request.params.activity;

    bookingArray.bookings.forEach((booking) => {
        if (booking.bookingDate === date && booking.bookingActivity === activity && booking.bookingStatus === 'confirmed') {
            seats += parseInt(booking.bookingGuests);
        }
    });
    respMessage = {bookedSeats: seats};
    response.json(respMessage);
});

/**
 * ADD NEW BOOKING
 * Booking form query that adds a new booking in the db
 */
recordRoutes.route("/booking/add/:id").post(async function (request, response) {
    let db_connect = dbo.getDb();
    let myQuery = {
        restaurantId: request.params.id
    };
    let booking = {
        id: request.body.id,
        bookingDate: request.body.bookingDate,
        bookingTime: request.body.bookingTime,
        bookingGuests: request.body.bookingGuests,
        bookingActivity: request.body.bookingActivity,
        bookingStatus: request.body.bookingStatus,
        guestName: request.body.guestName,
        guestSurname: request.body.guestSurname,
        guestEmail: request.body.guestEmail,
        guestPhone: request.body.guestPhone,
        guestAdditionalInfo: request.body.guestAdditionalInfo,
    }
    let newValues = {
        $push: {
            bookings: booking
        }
    };
    if (booking.bookingStatus === 'confirmed') {
        await addBookingToCalendar(request.params.id, booking);
    }
    db_connect
        .collection("booking")
        .updateOne(myQuery, newValues, function (err, res) {
            if (err) throw err;
            response.json(res);
        });
});

/**
 * REGISTER NEW USER
 */
recordRoutes.route("/register").post(async (request, response) => {
    const users = await getUsers()
    let exists = existingEmail(users, request.body.email)
    if (!exists) {
        let credentials = {
            email: request.body.email,
            password: request.body.password
        }
        let newRestaurantId = uuid.v4()
        let encryptedCredentials = encrypt(JSON.stringify(credentials))
        let db_connect = dbo.getDb()
        let newUser = {
            restaurantId: newRestaurantId,
            credentials: encryptedCredentials
        }
        db_connect
            .collection("authentication")
            .insertOne(newUser, function (err, res) {
                if (err) throw err;
                response.json({
                    restaurantId: newRestaurantId
                });
            });
        setupUsersCollections(newRestaurantId)
    } else if (users.length) {
        response.json({})
    }
})

/**
 * Gets all the users from the db
 * @returns array of users
 */
async function getUsers() {
    let db_connect = dbo.getDb("sdp_db");
    return await db_connect
        .collection("authentication")
        .find().toArray()
}

/**
 * Checks if an email already exists among a user array
 * @param users array of users
 * @param email we want to check
 * @returns {boolean} true if the email already exists
 */
function existingEmail(users, email) {
    for (let i = 0; i < users.length; i++) {
        let decrypted = JSON.parse(decrypt(users[i].credentials))
        if (decrypted.email === email) {
            return true
        }
    }
    return false
}

/**
 * Initializes new restaurant's collections in db
 * @param restaurantId id of the new restaurant
 */
function setupUsersCollections(newRestaurantId) {
    // Create new customize document
    newCustomizeDocument(newRestaurantId)
    // Create new activities document
    newActivitiesDocument(newRestaurantId)
    // booking
    newBookingsDocument(newRestaurantId)
}

/**
 * Initializes a new customize document in the customize collection
 * @param restaurantId
 */
function newCustomizeDocument(restaurantId) {
    let document = {
        restaurantId: restaurantId,
        additionalInfo: "",
        primaryColor: "",
        secondaryColor: "",
        logoPath: "",
        socialNetworks: "",
        restaurantName: ""
    }
    let db_connect = dbo.getDb()
    db_connect
        .collection("customize")
        .insertOne(document, function (err, res) {
            if (err) throw err;
        });
}

/**
 * Initializes a new activities document in the customize collection
 * @param restaurantId
 */
function newActivitiesDocument(restaurantId) {
    let document = {
        restaurantId: restaurantId,
        bookingForewarning: "",
        bookingThreshold: "",
        bookingOffset: "",
        activities: []
    }
    let db_connect = dbo.getDb()
    db_connect
        .collection("activities")
        .insertOne(document, function (err, res) {
            if (err) throw err;
        });
}

/**
 * Initializes a new bookings document in the customize collection
 * @param restaurantId
 */
function newBookingsDocument(restaurantId) {
    let document = {
        restaurantId: restaurantId,
        bookings: []
    }
    let db_connect = dbo.getDb()
    db_connect
        .collection("booking")
        .insertOne(document, function (err, res) {
            if (err) throw err;
        });
}

/**
 * DELETE EXISTING BOOKING
 * Booking form query that deletes a booking from the db
 */
recordRoutes.route("/booking/update").post(async function (req, response) {
    let db_connect = dbo.getDb();
    let myQuery = {
        restaurantId: req.body.id, 'bookings.id': req.body.bookingId
    };

    let restaurantBookings = await getRestaurantBookingsById(req.body.id, req.body.bookingId);
    let booking = getBookingById(restaurantBookings.bookings, req.body.bookingId);

    if(booking.bookingStatus !== 'canceled'){
        await removeBookingFromCalendar(req.body.id, req.body.bookingId);
        let newValues = {
            $set: {
                'bookings.$.bookingStatus': 'canceled'
            },
        };
        db_connect
            .collection("booking")
            .updateOne(myQuery, newValues, function (err, res) {
                if (err) throw err;
                // console.log("1 document updated");
                response.json(res);
            });
    } else {
        response.json({message: 'La prenotazione inserita è già cancellata'});
    }
});

/**
 * -------------- GOOGLE -------------------
 */

/**
 * Manages the user's tokens, storing them in an encrypted way. Returns to the client the user's info
 */
recordRoutes.route("/google/login").post(async (request, response) => {
    let {tokens} = await oauth2Client.getToken(request.body.code) //await oauth2Client.getToken(request.body.googleData);
    let restaurantId = request.body.restaurantId

    if (tokens.refresh_token) {
        let userInfo = {}
        if (tokens.access_token) {
            userInfo = await axios
                .get('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: {Authorization: `Bearer ${tokens.access_token}`},
                })
                .then(res => res.data)
            storeTokens(tokens, restaurantId)
            storeProfile(userInfo, restaurantId)
            response.send(JSON.stringify(userInfo))
        }
    }
})

/**
 * Fetches the user's google profile in the App component
 */
recordRoutes.route("/profile/:restaurantId").get(async (request, response) => {
    let profile = await getProfile(request.params.restaurantId)
    response.send(profile)
})

/**
 * Handles google logout, deletes document in db and revokes access to applications
 * Revoking access to application is necessary so that at the next login the refresh token will be given again
 */
recordRoutes.route("/google/logout/:restaurantId").delete(async (request, response) => {
    // Revoke access to application
    let restaurantId = request.params.restaurantId
    await revokeAccessToApp(restaurantId)
    let db_connect = dbo.getDb();
    let myQuery = {
        restaurantId: restaurantId
    };
    db_connect
        .collection("google_data") //
        .deleteOne(myQuery, function (err, result) {
            if (err) throw err;
            response.json(result)
        });

    // Revoke access to apps
})

/**
 * Stores the refresh token in the db in an encrypted format
 * @param tokens google oAuth2 tokens taken from login
 * @param restaurantId
 */
function storeTokens(tokens, restaurantId) {
    let db_connect = dbo.getDb("sdp_db");
    let myQuery = {
        restaurantId: restaurantId
    };
    // ENCRYPTION
    let encrypted = encrypt(JSON.stringify(tokens))
    let newValues = {
        $set: {
            tokens: encrypted
        },
    };
    db_connect
        .collection("google_data")
        .updateOne(myQuery, newValues, {upsert: true}, function (err, result) {
            if (err) throw err;
            console.log("1 document updated " + result);
        });
}

/**
 * Gets tokens from db corresponding to the restaurantId passed as argument
 * @param restaurantId
 */
async function getTokens(restaurantId) {
    let db_connect = dbo.getDb();
    let myQuery = {
        restaurantId: restaurantId
    };
    return db_connect
        .collection("google_data")
        .findOne(myQuery)
        .then((result) => JSON.parse(decrypt(result.tokens)))
}

/**
 * Stores google user's encrypted profile object
 * @param profile google user profile object
 * @param restaurantId
 */
function storeProfile(profile, restaurantId) {
    let db_connect = dbo.getDb("sdp_db");
    let myQuery = {restaurantId: restaurantId};
    // ENCRYPTION
    let encrypted = encrypt(JSON.stringify(profile))
    let newValues = {
        $set: {
            profile: encrypted
        },
    };
    db_connect
        .collection("google_data")
        .updateOne(myQuery, newValues, {upsert: true}, function (err, result) {
            if (err) throw err;
            console.log("1 document updated " + result);
        });
}

/**
 * Gets google user's profile object from the db
 * @param restaurantId
 * @returns {Promise<*>}
 */
async function getProfile(restaurantId) {
    let db_connect = dbo.getDb();
    let myQuery = {
        restaurantId: restaurantId
    };
    let googleData = await db_connect
        .collection("google_data")
        .findOne(myQuery)
        .then((result) => result)
    if (googleData && googleData.profile) {
        return JSON.parse(decrypt(googleData.profile))
    } else {
        return {}
    }

}

async function revokeAccessToApp(restaurantId) {
    let tokens = await getTokens(restaurantId)
    let postData = "token=" + tokens.refresh_token;

    // Options for POST request to Google's OAuth 2.0 server to revoke a token
    let postOptions = {
        host: 'oauth2.googleapis.com', port: '443', path: '/revoke', method: 'POST', headers: {
            'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData)
        }
    };
    // Set up the request
    const postReq = https.request(postOptions, function (res) {
        res.setEncoding('utf8');
        res.on('data', d => {
            console.log('Response: ' + d);
        });
    });

    postReq.on('error', error => {
        console.log(error)
    });

    // Post the request with data
    postReq.write(postData);
    postReq.end();
}

/**
 * [GOOGLE CALENDAR] Converts our booking object into a correct Google Event object
 * @param booking
 * @returns {{summary: string, start: {dateTime: string, timeZone: string}, description: string, end: {dateTime: string, timeZone: string}, id}}
 */
function bookingToGoogleEvent(booking) {
    const timeStampStart = booking.bookingDate + "T" + booking.bookingTime + ":00+02:00";
    let timeHour = parseInt(booking.bookingTime.substring(0, 2));
    let timeMin = booking.bookingTime.substring(3, 5);
    timeHour += 2;
    let endTime = String(timeHour) + ":" + timeMin;
    const timeStampEnd = booking.bookingDate + "T" + endTime + ":00+02:00";
    // parametrize the returned object with fields in booking
    return {
        id: booking.id,
        summary: booking.bookingActivity + ' per ' + booking.bookingGuests,
        description: booking.guestName + ' ' + booking.guestSurname + ' ha prenotato per ' + booking.bookingGuests + ' alle ' + booking.bookingTime + ' del ' + booking.bookingDate + '. I contatti di ' + booking.guestName + ' sono: ' + booking.guestPhone + ', ' + booking.guestEmail + '. ' + (booking.guestAdditionalInfo != null ? 'Il cliente ha lasciato un messaggio alla prenotazione: ' + booking.guestAdditionalInfo : ''),
        start: {
            dateTime: timeStampStart, timeZone: 'Europe/Rome',
        },
        end: {
            dateTime: timeStampEnd, timeZone: 'Europe/Rome',
        },
    }
}

/**
 * [GOOGLE CALENDAR] Adds a new Event to the restaurant's calendar
 * @param restaurantId
 * @param booking booking object
 * @returns {Promise<void>}
 */
async function addBookingToCalendar(restaurantId, booking) {
    let tokens = await getTokens(restaurantId)
    oauth2Client.setCredentials(tokens);
    let bookingEvent = bookingToGoogleEvent(booking)
    await calendar.events.insert({
        auth: oauth2Client, calendarId: 'primary', resource: bookingEvent,
    }, function (err, bookingEvent) {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return;
        }

    });
    console.log('Event created ' + bookingEvent.id);
}

/**
 * [GOOGLE CALENDAR] Removes event from restaurant's calendar
 * @param restaurantId
 * @param bookingId event's id and booking's id are the same
 * @returns {Promise<void>}
 */
async function removeBookingFromCalendar(restaurantId, bookingId) {
    let tokens = await getTokens(restaurantId)
    oauth2Client.setCredentials(tokens);
    console.log(bookingId)
    const res = await calendar.events.delete({
        auth: oauth2Client,
        calendarId: 'primary',
        eventId: bookingId,
    });
    console.log(res.data)
}

/**
 * -------------- TESTS -------------------
 */

module.exports = recordRoutes;