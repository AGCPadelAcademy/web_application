import React, { createContext, useState, useContext, useEffect } from 'react';

const BookingContext = createContext(null);

export const BookingProvider = ({ children }) => {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    const storedBookings = JSON.parse(localStorage.getItem('agc_bookings')) || [];
    setBookings(storedBookings);
  }, []);

  const addBooking = (booking) => {
    const newBookings = [...bookings, booking];
    setBookings(newBookings);
    localStorage.setItem('agc_bookings', JSON.stringify(newBookings));
  };

  const isSlotBooked = (date) => {
    return bookings.some(b => new Date(b.date).getTime() === new Date(date).getTime());
  };

  const value = { bookings, addBooking, isSlotBooked };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
};

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};