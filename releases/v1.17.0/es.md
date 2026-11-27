v1.17.0 — Las actualizaciones solo entran en el tablero por los cron jobs, y nada se instala sin tu sí

### Cambios
- **Las actualizaciones solo entran por los cron jobs que actives**: se acabó el disparador "Cuando aparece una actualización" y el aviso "Actualizaciones esperando un disparador". Una versión nueva solo va al tablero cuando el cron job de actualizaciones de esa app está activado con "Poner en el proyecto", o cuando la abres tú. En "Espera de estudio", el estudio sigue empezando solo. El disparador "Abrir cada update nuevo" que tenías se borra al instalar esta versión.
- **Nada se instala sin tu sí**: después del estudio, la actualización queda siempre en "Waiting for reply" con la recomendación y el botón "Sí, instalar", incluso con riesgo bajo. Solo pasa a "Ready to update" cuando lo digas.
