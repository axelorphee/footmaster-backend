module.exports = (err, req, res, next) => {
  console.error(err);

  const statusCode = err.statusCode || 500;

  let message = 'Une erreur est survenue. Veuillez réessayer.';

  if (err.isOperational && err.publicMessage) {
    message = err.publicMessage;
  } else if (statusCode === 401) {
    message = 'Identifiants invalides.';
  } else if (statusCode === 403) {
    message = 'Accès refusé.';
  } else if (statusCode === 404) {
    message = 'Ressource introuvable.';
  } else if (statusCode === 400) {
    message = 'Requête invalide.';
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};