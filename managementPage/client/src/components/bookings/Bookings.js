import 'bootstrap/dist/css/bootstrap.css';
import React from 'react';
import "./../../styles/pages.css"
import "./../../styles/bookings.css"
import Booking from './Booking';
import Filter from './Filter';
import {CSVLink} from "react-csv";
import {BsDownload} from 'react-icons/bs'
import {toast, ToastContainer} from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

import Cookies from 'universal-cookie';

const cookies = new Cookies();

const restaurantId = cookies.get('restaurantId')

let isSideOpen = true;

/**
 * Checks if a date is withina date range
 * @param date date to be checked
 * @param fromDate lower date bound
 * @param toDate upper date bound
 * @returns {boolean} true if the date is within the bounds
 */
function isDateInInterval(date, fromDate, toDate) {
    return date >= fromDate && date <= toDate
}

function filterByStatus(collection, status) {
    if (status === '' || status === 'Seleziona') {
        return collection
    }
    let filtered = {}
    Object.keys(collection).forEach((key) => {
        let booking = collection[key]
        if (booking.bookingStatus === status) {
            filtered[key] = booking
        }
    })
    return filtered
}

function filterByDate(collection, from, to) {
    if (from === ''
        && to === '') {
        return collection
    }
    let filtered = {}
    let fromDate = ''
    if (from !== '') {
        fromDate = new Date(from)
        fromDate.setHours(0,0,0,0)
    }
    let toDate = ''
    if (to !== '') {
        toDate = new Date(to)
        toDate.setHours(0,0,0,0)
    }
    Object.keys(collection).forEach((key) => {
        let booking = collection[key]
        let bookingDate = new Date(booking.bookingDate)
        bookingDate.setHours(0,0,0,0)
        if (isDateInInterval(bookingDate, fromDate, toDate)) {
            filtered[key] = booking
        }
    })
    return filtered
}

function isTimeInInterval(time, fromTime, toTime) {
    return time >= fromTime && time <= toTime;
}

function filterByTime(collection, from, to) {
    if(from === '' || to === ''){
        return collection
    }
    let filtered = {}
    let fromTime = new Date()
    fromTime.setHours(
        from.split(":")[0],
        from.split(":")[1],
        0)
    let toTime = new Date()
    toTime.setHours(
        to.split(":")[0],
        to.split(":")[1],
        0)
    Object.keys(collection).forEach((key) => {
        let booking = collection[key]
        let bookingTime = new Date()
        bookingTime.setHours(
            booking.bookingTime.split(":")[0],
            booking.bookingTime.split(":")[1],
            0)
        if (isTimeInInterval(bookingTime, fromTime, toTime)) {
            filtered[key] = booking
        }
    })
    return filtered;
}

function filterByActivity(collection, activity) {
    if(activity === ''){
        return collection
    }
    let filtered = {}
    Object.keys(collection).forEach((key) => {
        if(collection[key].bookingActivity === activity){
            filtered[key] = collection[key]
        }
    })
    return filtered;
}

/**
 * Contains activity bookings and manages addition and deletion of bookings of the table.
 */
export default class Bookings extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            bookings: {},
            filteredBookings: {},
            bookingsValues: {}
        }
        this.handleFiltering = this.handleFiltering.bind(this)
        this.getComponents = this.getComponents.bind(this)
        this.handleStatusChange = this.handleStatusChange.bind(this)
    }

    /**
     * Fetches the backend to retrieve information about the activities of the restaurant
     * Sets the state accordingly to what has been received by the databases
     */

    componentDidMount() {
        // Fetch giving the restaurant ID
        if (restaurantId) {
            fetch("/bookings/" + restaurantId, {
                method: "GET",
            })
                .then(res => res.json())
                .then(data => {
                    if (data) {
                        let fetchedBookings = {} // Instantiate the dictionary of booking bookings
                        let fetchedBookingsValues = {} // Instantiate the dictionary of booking values

                        // Fill dictionaries with data received from db
                        data.bookings.forEach((booking, index) => { // for each activity in the data.activities array
                            fetchedBookings[index] = // take the index and save a new Activity component in the object, the key of the component will be the index
                                <Booking
                                    restaurantId={restaurantId}
                                    key={index}
                                    uniqueId={index}
                                    booking={booking}
                                    onChange={this.handleStatusChange}/>
                            fetchedBookingsValues[index] = booking
                        })

                        // Update the state
                        this.setState({
                            bookings: fetchedBookings,
                            filteredBookings: fetchedBookingsValues, // At the start all the bookings are shown
                            bookingsValues: fetchedBookingsValues
                        })
                    }
                    // console.log(data)
                })
        }

    }

    /**
     * Handles filtering
     */
    handleFiltering(filters) {
        let filteredBookings
        if (!Object.values(filters).find(v => {
            return v !== ''
        })) { // if all the filters fields are empty -> return all the bookings (happens when filters are cleared)
            filteredBookings = this.state.bookingsValues
        } else {
            filteredBookings = filterByDate(this.state.bookingsValues, filters.fromDate, filters.toDate)
            filteredBookings = filterByTime(filteredBookings, filters.fromTime, filters.toTime)
            filteredBookings = filterByActivity(filteredBookings, filters.activity)
            filteredBookings = filterByStatus(filteredBookings, filters.status)
        }
        this.setState({
            filteredBookings: filteredBookings
        })
    }

    /**
     * Returns a list of Booking components based on the dictionary of filtered bookings
     * Takes the id of the booking and collects the Booking component from the dictionary
     */
    getComponents() {
        let result = {}
        Object.keys(this.state.bookings).forEach(key => {
            if (Object.keys(this.state.filteredBookings).includes(key)) {
                result[key] = this.state.bookings[key]
            }
        })
        return result
    }

    handleStatusChange(uniqueId, newStatus, savedSuccessfully) {
        if (savedSuccessfully) {
            let newBookingsValues = this.state.bookingsValues
            newBookingsValues[uniqueId].bookingStatus = newStatus
            this.setState({
                bookingsValues: newBookingsValues
            })
            toast.success('Salvataggio effettuato.', {
                toastId: 'saved',
                position: "bottom-center",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
            });
        } else {
            toast.error('Salvataggio fallito.', {
                toastId: 'save_error',
                position: "top-right",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: true,
                pauseOnHover: true,
                draggable: true,
                progress: undefined,
            });

        }

    }

    handleSideBarChange() {
        let sideBar = document.querySelector("#sidebarDiv");
        let main = document.querySelector("#mainContentContainer");

        if (isSideOpen) {
            sideBar.removeAttribute("style");
            main.setAttribute("style", "marginLeft: 0");
            isSideOpen = false;
        } else {
            sideBar.setAttribute("style", "display: block;");
            main.setAttribute("style", "marginLeft: 250px");
            isSideOpen = true;
        }
    }

    getActivitiesNames() {
        let activitiesNames = new Set()
        Object.keys(this.state.bookingsValues).forEach((key) => {
            let booking = this.state.bookingsValues[key]
            activitiesNames.add(booking.bookingActivity)
        })
        return activitiesNames;
    }

    render() {
        let bookingsToBeShown = Object.values(this.getComponents())
        let csvData = Object.values(this.state.filteredBookings).map(booking => {
            return structuredClone(booking)
        })
        csvData.forEach((booking) => {
            delete booking.id
        })

        let activitiesNames = this.getActivitiesNames()
        return (

            <>
                <button className='openbtn' onClick={this.handleSideBarChange}>&#9776;</button>
                <div>
                    <div>
                        <h4>Lista prenotazioni</h4>
                        <CSVLink
                            data={csvData}
                            filename={"prenotazioni.csv"}
                            className="btn btn-primary"
                            target="_blank">
                            Download .CSV
                            <BsDownload/>
                        </CSVLink>

                        <hr></hr>
                    </div>
                    <div>
                        Filtri
                        <Filter
                            onClick={this.handleFiltering}
                            activitiesNames={activitiesNames}/>
                    </div>
                    <table id="bookingsTable" >
                        <thead>
                        <tr>
                            <th className="headerCol" scope="col">Nome</th>
                            <th className="headerCol" scope="col">Attività</th>
                            <th className="headerCol" scope="col">Numero coperti</th>
                            <th className="headerCol" scope="col">Giorno</th>
                            <th className="headerCol" scope="col">Ora</th>
                            <th className="headerCol" scope="col">Contatti</th>
                            <th className="headerCol" scope="col">Stato</th>
                        </tr>
                        </thead>
                        {/* Renders all the bookings */}
                        <tbody style={{border: 0, margin: 0, padding: 0}}>
                        {bookingsToBeShown}
                        </tbody>
                    </table>
                    <ToastContainer
                        position="bottom-center"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop={false}
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                    />
                    {/* Same as */}
                    <ToastContainer/>
                </div>
            </>
        )
    }


}