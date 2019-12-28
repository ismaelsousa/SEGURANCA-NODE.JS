import { isBefore, subHours } from 'date-fns';
import Appointment from '../models/Appointment';
import User from '../models/User';
import CancellationMail from '../jobs/CancellationMail';
import Cache from '../../lib/Cache';
import Queue from '../../lib/Queue';

class CancallAppointmentService {
  async run({ provider_id, user_id }) {
    const appointment = await Appointment.findByPk(provider_id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== user_id) {
      throw new Error("you don't have permission to cancel this appointment");
    }
    /**
     * reduz a hora em duas a menos e verifica se é antes da hota atual
     */
    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      throw new Error('you can onlyy cancel appointments 2 hours in advance');
    }
    appointment.canceled_at = new Date();

    await appointment.save();

    // Coloca na fila para ser processado
    Queue.add(CancellationMail.key, {
      appointment,
    });
    /**
     * Invalidate cache
     */
    await Cache.invalidatePrefix(`user:${user_id}:appointments`);
    return appointment;
  }
}

export default new CancallAppointmentService();
